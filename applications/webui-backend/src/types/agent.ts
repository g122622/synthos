/**
 * Agent 相关类型定义
 */

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
