/**
 * Agent 服务
 * 处理 Agent 问答、对话历史的业务逻辑
 */
import { inject, injectable } from "tsyringe";
import Logger from "@root/common/util/Logger";
import { RAGClient } from "../rpc/aiModelClient";
import type {
    AgentAskOutput,
    AgentEvent,
    AgentForkFromCheckpointOutput,
    AgentGetStateHistoryOutput
} from "@root/common/rpc/ai-model/schemas";
import { TOKENS } from "../di/tokens";
import { randomUUID } from "crypto";

/**
 * Agent 消息类型
 */
export interface AgentMessage {
    id: string;
    conversationId: string;
    role: "user" | "assistant";
    content: string;
    timestamp: number;
    toolsUsed?: string[];
    toolRounds?: number;
    tokenUsage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

/**
 * Agent 对话类型
 */
export interface AgentConversation {
    id: string;
    sessionId?: string;
    title: string;
    createdAt: number;
    updatedAt: number;
}

/**
 * Agent 问答请求参数
 */
export interface AgentAskRequest {
    question: string;
    conversationId?: string;
    sessionId?: string;
    enabledTools?: Array<"rag_search" | "sql_query" | "web_search">;
    maxToolRounds?: number;
    temperature?: number;
    maxTokens?: number;
}

@injectable()
export class AgentService {
    private LOGGER = Logger.withTag("AgentService");

    // 单实例内存锁：按 conversationId 拒绝并发 run
    private runningConversationIds = new Set<string>();

    constructor(@inject(TOKENS.RAGClient) private ragClient: RAGClient) {}

    public tryAcquireConversationLock(conversationId: string): boolean {
        if (this.runningConversationIds.has(conversationId)) {
            return false;
        }
        this.runningConversationIds.add(conversationId);
        return true;
    }

    public releaseConversationLock(conversationId: string): void {
        this.runningConversationIds.delete(conversationId);
    }

    /**
     * 发起 Agent 问答
     * @param request 问答请求参数
     * @returns Agent 问答结果
     */
    public async askAgent(request: AgentAskRequest): Promise<AgentAskOutput> {
        this.LOGGER.info(`Agent 问答: ${request.question.substring(0, 50)}...`);

        try {
            // 调用 ai-model 的 agentAsk RPC 接口
            const result = await this.ragClient.agentAsk.mutate({
                question: request.question,
                conversationId: request.conversationId,
                sessionId: request.sessionId,
                enabledTools: request.enabledTools || ["rag_search", "sql_query"],
                maxToolRounds: request.maxToolRounds || 5,
                temperature: request.temperature || 0.7,
                maxTokens: request.maxTokens || 2048
            });

            this.LOGGER.info(
                `Agent 问答完成，conversationId: ${result.conversationId}, ` +
                    `工具调用轮次: ${result.toolRounds}, ` +
                    `使用的工具: ${result.toolsUsed?.join(", ") || "无"}`
            );

            return result;
        } catch (error) {
            this.LOGGER.error(`Agent 问答失败: ${error instanceof Error ? error.message : String(error)}`);
            throw new Error(`Agent 问答失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 发起 Agent 问答（流式事件）
     * 用于 webui-backend REST SSE 转发
     */
    public async askAgentStream(
        request: AgentAskRequest,
        options: {
            abortSignal: AbortSignal;
            onEvent: (evt: AgentEvent) => void;
        }
    ): Promise<void> {
        const conversationId = request.conversationId || randomUUID();

        this.LOGGER.info(
            `Agent SSE 问答: ${request.question.substring(0, 50)}... conversationId=${conversationId}`
        );

        return new Promise((resolve, reject) => {
            let finished = false;

            const safeResolve = () => {
                if (finished) {
                    return;
                }
                finished = true;
                resolve();
            };

            const safeReject = (err: unknown) => {
                if (finished) {
                    return;
                }
                finished = true;
                reject(err);
            };

            const sub = this.ragClient.agentAskStream.subscribe(
                {
                    question: request.question,
                    conversationId,
                    sessionId: request.sessionId,
                    enabledTools: request.enabledTools || ["rag_search", "sql_query"],
                    maxToolRounds: request.maxToolRounds || 5,
                    temperature: request.temperature || 0.7,
                    maxTokens: request.maxTokens || 2048
                },
                {
                    onData: (evt: AgentEvent) => {
                        options.onEvent(evt);
                        if (evt.type === "done" || evt.type === "error") {
                            safeResolve();
                        }
                    },
                    onError: err => {
                        safeReject(err);
                    },
                    onComplete: () => {
                        safeResolve();
                    }
                }
            );

            const handleAbort = () => {
                try {
                    sub.unsubscribe();
                } catch {
                    // ignore
                }
                safeResolve();
            };

            if (options.abortSignal.aborted) {
                handleAbort();
                return;
            }

            options.abortSignal.addEventListener("abort", handleAbort, { once: true });
        });
    }

    public async getStateHistory(input: {
        conversationId: string;
        limit: number;
        beforeCheckpointId?: string;
    }): Promise<AgentGetStateHistoryOutput> {
        return this.ragClient.agentGetStateHistory.query({
            conversationId: input.conversationId,
            limit: input.limit,
            beforeCheckpointId: input.beforeCheckpointId
        });
    }

    public async forkFromCheckpoint(input: {
        conversationId: string;
        checkpointId: string;
        newConversationId?: string;
    }): Promise<AgentForkFromCheckpointOutput> {
        return this.ragClient.agentForkFromCheckpoint.mutate({
            conversationId: input.conversationId,
            checkpointId: input.checkpointId,
            newConversationId: input.newConversationId
        });
    }

    /**
     * 获取对话列表（通过 RPC 调用 AgentDbAccessService）
     */
    public async getConversations(
        sessionId: string | undefined,
        beforeUpdatedAt: number | undefined,
        limit: number
    ): Promise<AgentConversation[]> {
        this.LOGGER.info(
            `获取 Agent 对话列表, sessionId: ${sessionId || ""}, beforeUpdatedAt: ${beforeUpdatedAt || ""}, limit: ${limit}`
        );

        const conversations = await this.ragClient.agentGetConversations.query({
            sessionId,
            beforeUpdatedAt,
            limit
        });

        return conversations as unknown as AgentConversation[];
    }

    /**
     * 获取对话的消息列表
     */
    public async getMessages(
        conversationId: string,
        beforeTimestamp: number | undefined,
        limit: number
    ): Promise<AgentMessage[]> {
        this.LOGGER.info(
            `获取 Agent 消息列表, conversationId: ${conversationId}, beforeTimestamp: ${beforeTimestamp || ""}, limit: ${limit}`
        );

        const messages = await this.ragClient.agentGetMessages.query({
            conversationId,
            beforeTimestamp,
            limit
        });

        // 兼容前端期望的结构：toolsUsed/tokenUsage 在 DB 中是 JSON 字符串
        return (messages as any[]).map(m => {
            let toolsUsed: string[] | undefined;
            let tokenUsage: any | undefined;

            try {
                toolsUsed = m.toolsUsed ? JSON.parse(m.toolsUsed) : undefined;
            } catch {
                toolsUsed = undefined;
            }

            try {
                tokenUsage = m.tokenUsage ? JSON.parse(m.tokenUsage) : undefined;
            } catch {
                tokenUsage = undefined;
            }

            return {
                id: m.id,
                conversationId: m.conversationId,
                role: m.role,
                content: m.content,
                timestamp: m.timestamp,
                toolsUsed,
                toolRounds: m.toolRounds,
                tokenUsage
            } as AgentMessage;
        });
    }
}
