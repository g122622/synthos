/**
 * Agent 服务
 * 处理 Agent 问答、对话历史的业务逻辑
 */
import { injectable } from "tsyringe";
import Logger from "@root/common/util/Logger";
import { RAGClient } from "../rpc/aiModelClient";
import type { AgentAskInput, AgentAskOutput } from "@root/common/rpc/ai-model/schemas";

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

    constructor(private ragClient: RAGClient) {}

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
     * 获取对话列表（通过 RPC 调用 AgentDbAccessService）
     * 注意：由于目前 tRPC router 未暴露对话列表接口，暂时返回空数组
     * TODO: 在 ai-model 的 router 中添加 getConversations 和 getMessages 接口
     */
    public async getConversations(sessionId?: string, limit: number = 50): Promise<AgentConversation[]> {
        this.LOGGER.info(`获取 Agent 对话列表, sessionId: ${sessionId}, limit: ${limit}`);

        // TODO: 等待 ai-model 暴露对话列表 RPC 接口后实现
        // 目前返回空数组，前端暂时无法展示历史对话
        this.LOGGER.warning("getConversations 功能尚未实现，需要在 ai-model RPC 中添加对应接口");
        return [];
    }

    /**
     * 获取对话的消息列表
     * 注意：由于目前 tRPC router 未暴露消息列表接口，暂时返回空数组
     * TODO: 在 ai-model 的 router 中添加 getMessages 接口
     */
    public async getMessages(conversationId: string): Promise<AgentMessage[]> {
        this.LOGGER.info(`获取 Agent 消息列表, conversationId: ${conversationId}`);

        // TODO: 等待 ai-model 暴露消息列表 RPC 接口后实现
        this.LOGGER.warning("getMessages 功能尚未实现，需要在 ai-model RPC 中添加对应接口");
        return [];
    }
}
