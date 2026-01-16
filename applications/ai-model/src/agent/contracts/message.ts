import { TokenUsage } from "./metadata";
import { ToolCall } from "./tools";

/**
 * Agent 流式响应 chunk 类型
 */
export interface AgentStreamChunk {
    /** Chunk 类型 */
    type: "content" | "tool_start" | "tool_result" | "done" | "error";
    /** 文本内容（type="content" 时） */
    content?: string;
    /** 工具名称（type="tool_start" 或 "tool_result" 时） */
    toolName?: string;
    /** 工具参数（type="tool_start" 时） */
    toolParams?: Record<string, unknown>;
    /** 工具结果（type="tool_result" 时） */
    toolResult?: unknown;
    /** 错误信息（type="error" 时） */
    error?: string;
    /** 是否完成（type="done" 时） */
    isFinished?: boolean;
    /** Token 使用量（type="done" 时） */
    usage?: TokenUsage;
}

/**
 * 聊天消息类型
 */
export interface ChatMessage {
    /** 消息角色 */
    role: "system" | "user" | "assistant" | "tool";
    /** 消息内容 */
    content: string;
    /** 工具调用信息（role="assistant" 时） */
    tool_calls?: ToolCall[];
    /** 工具调用 ID（role="tool" 时） */
    tool_call_id?: string;
    /** 工具名称（role="tool" 时） */
    name?: string;
}
