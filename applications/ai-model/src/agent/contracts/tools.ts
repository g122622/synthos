/**
 * Agent 系统类型定义
 */

/**
 * 工具调用参数
 */
export interface ToolCall {
    /** 工具调用 ID */
    id: string;
    /** 工具名称 */
    name: string;
    /** 工具参数（JSON 对象） */
    arguments: Record<string, unknown>;
}

/**
 * 工具定义（遵循 OpenAI Function Calling 格式）
 */
export interface ToolDefinition {
    /** 工具类型，固定为 "function" */
    type: "function";
    /** 函数定义 */
    function: {
        /** 函数名称 */
        name: string;
        /** 函数描述 */
        description: string;
        /** 参数 schema（JSON Schema 格式） */
        parameters: {
            type: "object";
            properties: Record<string, unknown>;
            required?: string[];
        };
    };
}

/**
 * 工具执行器函数类型
 */
export type ToolExecutor<T = Record<string, unknown>> = (params: T, context: ToolContext) => Promise<unknown>;

/**
 * 工具执行上下文
 */
export interface ToolContext {
    /** 会话 ID */
    sessionId?: string;
    /** 用户 ID（可选） */
    userId?: string;
    /** 其他上下文信息 */
    [key: string]: unknown;
}

/**
 * 已注册的工具
 */
export interface RegisteredTool {
    /** 工具定义 */
    definition: ToolDefinition;
    /** 工具执行器 */
    executor: ToolExecutor;
}

/**
 * 工具执行结果
 */
export interface ToolExecutionResult {
    /** 工具名称 */
    toolName: string;
    /** 工具调用 ID */
    toolCallId: string;
    /** 执行是否成功 */
    success: boolean;
    /**
     * 工具结果归档引用（写入变量空间后的 key）。
     *
     * 约定：当存在 sessionId 时，AgentExecutor 会自动把每次工具调用的输出归档到变量空间并生成该 ref。
     * LLM 侧可将其用于 evidence.ref（可追溯证据）。
     */
    archivedRef?: string;
    /** 执行结果（JSON 可序列化） */
    result?: unknown;
    /** 错误信息（如果失败） */
    error?: string;
}
