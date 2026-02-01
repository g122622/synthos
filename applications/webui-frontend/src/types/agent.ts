/**
 * Agent相关的类型定义
 */

/**
 * AI Chat标签页类型
 */
export type AiChatTab = "ask" | "search" | "agent";

/**
 * Agent消息类型
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
 * Agent对话类型
 */
export interface AgentConversation {
    id: string;
    sessionId?: string;
    title: string;
    createdAt: number;
    updatedAt: number;
}

/**
 * Agent问答请求参数
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
 * Agent问答响应
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

/**
 * Agent SSE事件
 */
export type AgentEvent =
    | {
          type: "token";
          ts: number;
          conversationId: string;
          content: string;
      }
    | {
          type: "tool_call";
          ts: number;
          conversationId: string;
          toolCallId: string;
          toolName: string;
          toolArgs: unknown;
      }
    | {
          type: "tool_result";
          ts: number;
          conversationId: string;
          toolCallId: string;
          toolName: string;
          result: unknown;
      }
    | {
          type: "done";
          ts: number;
          conversationId: string;
          messageId?: string;
          content?: string;
          toolsUsed?: string[];
          toolRounds?: number;
          totalUsage?: {
              promptTokens: number;
              completionTokens: number;
              totalTokens: number;
          };
      }
    | {
          type: "error";
          ts: number;
          conversationId: string;
          error: string;
      };

/**
 * Agent流式响应块（用于tRPC）
 */
export interface AskStreamChunk {
    type: "content" | "references" | "done" | "error";
    content?: string;
    references?: Array<{
        topicId: string;
        topic: string;
        relevance: number;
    }>;
    error?: string;

    // 由webui-backend保存会话时提供
    sessionId?: string;
    isFailed?: boolean;
    failReason?: string;
}

/**
 * Agent流式请求输入（用于tRPC）
 */
export interface AskStreamInput {
    question: string;
    topK?: number;
    enableQueryRewriter?: boolean;
}
