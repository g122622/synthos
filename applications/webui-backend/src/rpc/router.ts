import type { RAGClient } from "./aiModelClient";
import type { OrchestratorClient } from "./orchestratorClient";
import type { RagChatHistoryService } from "../services/RagChatHistoryService";
import type { ReferenceItem } from "@root/common/rpc/ai-model/index";

import { initTRPC } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { container } from "tsyringe";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
    AgentAskInputSchema,
    AskInputSchema,
    AgentEvent,
    AskStreamChunk
} from "@root/common/rpc/ai-model/schemas";
import {
    GetWorkflowInputSchema,
    TriggerWorkflowInputSchema,
    CancelExecutionInputSchema,
    RetryExecutionInputSchema,
    ListExecutionsInputSchema,
    GetExecutionInputSchema,
    OnExecutionUpdateInputSchema
} from "@root/common/rpc/orchestrator/index";
import { TaskRegistry, SerializableTaskMetadata } from "@root/common/scheduler/registry/index";
import { COMMON_TOKENS } from "@root/common/di/tokens";

import { TOKENS } from "../di/tokens";

const t = initTRPC.create();

export const appRouter = t.router({
    agentAskStream: t.procedure.input(AgentAskInputSchema).subscription(({ input }) => {
        return observable<AgentEvent>(emit => {
            const client = container.resolve<RAGClient>(TOKENS.RAGClient);

            // 重要：需要处理类型匹配，因为 RPC Client 和 Subscription 类型定义虽然相同，但 TS 可能会报错
            // 如果 rpc-client 的 subscribe 返回的是 { unsubscribe: ... }
            const sub = client.agentAskStream.subscribe(input, {
                onData: data => emit.next(data),
                onError: err => emit.error(err),
                onComplete: () => emit.complete()
            });

            return () => sub.unsubscribe();
        });
    }),
    askStream: t.procedure.input(AskInputSchema).subscription(({ input }) => {
        return observable<AskStreamChunk>(emit => {
            const client = container.resolve<RAGClient>(TOKENS.RAGClient);
            const ragChatHistoryService = container.resolve<RagChatHistoryService>(TOKENS.RagChatHistoryService);

            // 重新 parse 一次以获得 zod default 的输出类型（避免 tRPC 这里推导为 input 类型导致的可选字段）
            const normalizedInput = AskInputSchema.parse(input);
            const question = normalizedInput.question ?? input.question ?? "";
            const topK = normalizedInput.topK ?? input.topK ?? 5;
            const enableQueryRewriter = normalizedInput.enableQueryRewriter ?? input.enableQueryRewriter ?? true;

            // 断线续跑：客户端断开后仍继续消费 ai-model 的 stream 并在结束后落库。
            // clientConnected 仅影响是否向前端 emit，不影响底层订阅。
            let clientConnected = true;

            // 流式累积：用于最终保存会话（包括失败场景保存部分内容）
            let answerBuffer = "";
            let referencesBuffer: ReferenceItem[] = [];
            let isFailed = false;
            let failReason = "";
            let hasSaved = false;

            const saveIfNeeded = async (): Promise<string | null> => {
                if (hasSaved) {
                    return null;
                }

                const hasAnyContent = !!answerBuffer || referencesBuffer.length > 0 || isFailed;

                if (!hasAnyContent) {
                    return null;
                }

                hasSaved = true;

                const session = await ragChatHistoryService.createSession({
                    question,
                    answer: answerBuffer,
                    references: referencesBuffer,
                    topK,
                    enableQueryRewriter,
                    isFailed,
                    failReason
                });

                return session.id;
            };

            const safeEmitNext = (chunk: AskStreamChunk) => {
                if (!clientConnected) return;
                emit.next(chunk);
            };

            const safeComplete = () => {
                if (!clientConnected) return;
                emit.complete();
            };

            const sub = client.askStream.subscribe(input, {
                onData: (data: unknown) => {
                    const chunk = data as AskStreamChunk;

                    if (chunk.type === "content" && chunk.content) {
                        answerBuffer += chunk.content;
                    }

                    if (chunk.type === "references" && chunk.references) {
                        referencesBuffer = chunk.references
                            .filter(
                                (r): r is { topicId: string; topic: string; relevance: number } =>
                                    typeof r.topicId === "string" &&
                                    typeof r.topic === "string" &&
                                    typeof r.relevance === "number"
                            )
                            .map(r => ({
                                topicId: r.topicId,
                                topic: r.topic,
                                relevance: r.relevance
                            }));
                    }

                    if (chunk.type === "error" && chunk.error) {
                        isFailed = true;
                        failReason = chunk.error;
                        answerBuffer += `\n\n【生成失败】原因：${chunk.error}`;
                    }

                    safeEmitNext(chunk);
                },
                onError: err => {
                    void (async () => {
                        // 这是底层订阅/传输错误（非 ai-model 主动发出的 error chunk）
                        isFailed = true;
                        failReason = err instanceof Error ? err.message : String(err);
                        answerBuffer += `\n\n【生成失败】原因：${failReason}`;

                        let sessionId: string | null = null;

                        try {
                            sessionId = await saveIfNeeded();
                        } catch {
                            // ignore
                        } finally {
                            sub.unsubscribe();
                        }

                        safeEmitNext({ type: "error", error: failReason });
                        safeEmitNext({
                            type: "done",
                            sessionId: sessionId || undefined,
                            isFailed: true,
                            failReason
                        });
                        safeComplete();
                    })();
                },
                onComplete: () => {
                    void (async () => {
                        let sessionId: string | null = null;

                        try {
                            sessionId = await saveIfNeeded();
                        } catch (saveErr) {
                            isFailed = true;
                            failReason = saveErr instanceof Error ? saveErr.message : String(saveErr);
                        } finally {
                            sub.unsubscribe();
                        }

                        safeEmitNext({
                            type: "done",
                            sessionId: sessionId || undefined,
                            isFailed,
                            failReason: failReason || undefined
                        });
                        safeComplete();
                    })();
                }
            });

            // 关键：客户端断开时不取消 ai-model 的订阅，保证“断线续跑”。
            // 仅停止向前端 emit。
            return () => {
                clientConnected = false;
            };
        });
    }),

    // ==================== Orchestrator 相关接口（扁平结构） ====================

    listWorkflows: t.procedure.query(async () => {
        const client = container.resolve<OrchestratorClient>(TOKENS.OrchestratorClient);

        // @ts-ignore - tRPC 类型推断问题，运行时正常
        return client.listWorkflows.query();
    }),

    getWorkflow: t.procedure.input(GetWorkflowInputSchema).query(async ({ input }) => {
        const client = container.resolve<OrchestratorClient>(TOKENS.OrchestratorClient);

        // @ts-ignore - tRPC 类型推断问题，运行时正常
        return client.getWorkflow.query(input);
    }),

    triggerWorkflow: t.procedure.input(TriggerWorkflowInputSchema).mutation(async ({ input }) => {
        const client = container.resolve<OrchestratorClient>(TOKENS.OrchestratorClient);

        // @ts-ignore - tRPC 类型推断问题，运行时正常
        return client.triggerWorkflow.mutate(input);
    }),

    cancelExecution: t.procedure.input(CancelExecutionInputSchema).mutation(async ({ input }) => {
        const client = container.resolve<OrchestratorClient>(TOKENS.OrchestratorClient);

        // @ts-ignore - tRPC 类型推断问题，运行时正常
        return client.cancelExecution.mutate(input);
    }),

    retryExecution: t.procedure.input(RetryExecutionInputSchema).mutation(async ({ input }) => {
        const client = container.resolve<OrchestratorClient>(TOKENS.OrchestratorClient);

        // @ts-ignore - tRPC 类型推断问题，运行时正常
        return client.retryExecution.mutate(input);
    }),

    listExecutions: t.procedure.input(ListExecutionsInputSchema).query(async ({ input }) => {
        const client = container.resolve<OrchestratorClient>(TOKENS.OrchestratorClient);

        // @ts-ignore - tRPC 类型推断问题，运行时正常
        return client.listExecutions.query(input);
    }),

    getExecution: t.procedure.input(GetExecutionInputSchema).query(async ({ input }) => {
        const client = container.resolve<OrchestratorClient>(TOKENS.OrchestratorClient);

        // @ts-ignore - tRPC 类型推断问题，运行时正常
        return client.getExecution.query(input);
    }),

    onExecutionUpdate: t.procedure.input(OnExecutionUpdateInputSchema).subscription(({ input }) => {
        return observable(emit => {
            const client = container.resolve<OrchestratorClient>(TOKENS.OrchestratorClient);
            // @ts-ignore - tRPC 类型推断问题，运行时正常
            const sub = client.onExecutionUpdate.subscribe(input, {
                onData: data => emit.next(data),
                onError: err => emit.error(err),
                onComplete: () => emit.complete()
            });

            return () => sub.unsubscribe();
        });
    }),

    /**
     * 获取所有已注册任务的元数据
     * 返回任务名称、显示名称、参数 JSON Schema 等
     */
    getTaskRegistry: t.procedure.query(async () => {
        const taskRegistry = container.resolve<TaskRegistry>(COMMON_TOKENS.TaskRegistry);
        const allTasks = await taskRegistry.getAllRegisteredTasks();

        // 将 Zod Schema 转换为 JSON Schema 以便前端使用
        const serializedTasks: SerializableTaskMetadata[] = allTasks.map(task => ({
            internalName: task.internalName,
            displayName: task.displayName,
            description: task.description,
            paramsJsonSchema: zodToJsonSchema(task.paramsSchema, {
                name: `${task.internalName}Params`,
                errorMessages: true
            })
        }));

        return { tasks: serializedTasks };
    })
});

export type AppRouter = typeof appRouter;
