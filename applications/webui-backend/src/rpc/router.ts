import { initTRPC } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { container } from "tsyringe";
import { TOKENS } from "../di/tokens";
import type { RAGClient } from "./aiModelClient";
import type { RagChatHistoryService, ReferenceItem as RagReferenceItem } from "../services/RagChatHistoryService";
import {
    AgentAskInputSchema,
    AskInputSchema,
    AgentEvent,
    AskStreamChunk
} from "@root/common/rpc/ai-model/schemas";

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
            let referencesBuffer: RagReferenceItem[] = [];
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
    })
});

export type AppRouter = typeof appRouter;
