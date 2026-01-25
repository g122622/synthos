import { TokenUsage } from "./metadata";
import { ToolCall } from "./tools";

/**
 * Agent 流式响应事件（稳定业务事件）
 */
export interface AgentStreamChunk {
    /** 事件类型 */
    type: "token" | "tool_call" | "tool_result" | "done" | "error";

    /** 事件发生时间（UNIX 毫秒时间戳） */
    ts: number;

    /** 对话 ID（对应 LangGraph thread_id） */
    conversationId: string;

    /** token 文本（type="token" 时） */
    content?: string;

    /** 工具调用 ID（type="tool_call" / "tool_result" 时） */
    toolCallId?: string;

    /** 工具名称（type="tool_call" / "tool_result" 时） */
    toolName?: string;

    /** 工具参数（type="tool_call" 时，任意 JSON） */
    toolArgs?: unknown;

    /** 工具结果（type="tool_result" 时，任意 JSON） */
    result?: unknown;

    /** done 时回传的 messageId（如果已落库） */
    messageId?: string;

    /** done 时回传的工具列表 */
    toolsUsed?: string[];

    /** done 时回传的工具轮次 */
    toolRounds?: number;

    /** done 时回传的 token usage */
    totalUsage?: TokenUsage;

    /** 错误信息（type="error" 时） */
    error?: string;
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
