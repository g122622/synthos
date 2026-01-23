/**
 * Agent API 接口
 * 用于调用 Agent 问答、对话历史相关接口
 */
import API_BASE_URL from "./constants/baseUrl";

import fetchWrapper from "@/util/fetchWrapper";
import { mockConfig } from "@/config/mock";
import { mockAgentAsk, mockGetAgentConversations, mockGetAgentMessages } from "@/mock/agentMock";

// ==================== 类型定义 ====================

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

/**
 * Agent 问答响应
 */
export interface AgentAskResponse {
    conversationId: string;
    messageId: string;
    content: string;
    toolsUsed: string[];
    toolRounds: number;
    totalUsage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

// ==================== API 接口 ====================

/**
 * Agent 问答
 * @param request 问答请求参数
 */
export const agentAsk = async (request: AgentAskRequest): Promise<ApiResponse<AgentAskResponse>> => {
    if (mockConfig.agent) {
        return mockAgentAsk(request);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/agent/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request)
    });

    return response.json();
};

/**
 * 获取对话列表
 * @param sessionId 会话ID（可选）
 * @param limit 返回结果数量限制
 */
export const getAgentConversations = async (sessionId: string | undefined, beforeUpdatedAt: number | undefined, limit: number = 20): Promise<ApiResponse<AgentConversation[]>> => {
    if (mockConfig.agent) {
        return mockGetAgentConversations(sessionId, beforeUpdatedAt, limit);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/agent/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, beforeUpdatedAt, limit })
    });

    return response.json();
};

/**
 * 获取对话的消息列表
 * @param conversationId 对话ID
 */
export const getAgentConversationsPage = async (sessionId: string | undefined, beforeUpdatedAt: number | undefined, limit: number = 20): Promise<ApiResponse<AgentConversation[]>> => {
    if (mockConfig.agent) {
        return mockGetAgentConversations(sessionId, beforeUpdatedAt, limit);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/agent/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, beforeUpdatedAt, limit })
    });

    return response.json();
};

export const getAgentMessages = async (conversationId: string, beforeTimestamp: number | undefined, limit: number = 20): Promise<ApiResponse<AgentMessage[]>> => {
    if (mockConfig.agent) {
        return mockGetAgentMessages(conversationId, beforeTimestamp, limit);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/agent/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beforeTimestamp, limit })
    });

    return response.json();
};
