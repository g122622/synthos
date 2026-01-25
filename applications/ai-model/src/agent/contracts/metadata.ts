/**
 * Token 使用统计
 */
export interface TokenUsage {
    /** 输入 Token 数 */
    promptTokens: number;
    /** 输出 Token 数 */
    completionTokens: number;
    /** 总 Token 数 */
    totalTokens: number;
}

/**
 * Agent 执行结果
 */
export interface AgentResult {
    /** 最终文本响应 */
    content: string;
    /** 使用过的工具列表 */
    toolsUsed: string[];
    /** 工具调用轮数 */
    toolRounds: number;
    /** 总 Token 使用量 */
    totalUsage?: TokenUsage;
}

/**
 * Agent 配置选项
 */
export interface AgentConfig {
    /** 启用的工具列表（未启用工具对模型不可见/不可调用） */
    enabledTools?: string[];
    /** 最大工具调用轮数（防止无限循环） */
    maxToolRounds?: number;
    /** LLM 温度参数 */
    temperature?: number;
    /** 最大输出 Token 数 */
    maxTokens?: number;
    /** 中止信号（用于取消执行） */
    abortSignal?: AbortSignal;
}
