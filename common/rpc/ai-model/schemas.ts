/**
 * AI Model RPC Schemas
 * 定义 RPC 接口的输入/输出类型
 */
import { z } from "zod";

// ========== 搜索接口 ==========

export const SearchInputSchema = z.object({
    query: z.string().min(1, "查询内容不能为空"),
    limit: z.number().int().positive().default(10)
});

export const SearchResultItemSchema = z.object({
    topicId: z.string(),
    topic: z.string(),
    detail: z.string(),
    distance: z.number(),
    contributors: z.string()
});

export const SearchOutputSchema = z.array(SearchResultItemSchema);

// ========== RAG 问答接口 ==========

export const AskInputSchema = z.object({
    question: z.string().min(1, "问题不能为空"),
    topK: z.number().int().positive().default(5),
    enableQueryRewriter: z.boolean().default(true)
});

export const ReferenceItemSchema = z.object({
    topicId: z.string(),
    topic: z.string(),
    relevance: z.number()
});

export const AskOutputSchema = z.object({
    answer: z.string(),
    references: z.array(ReferenceItemSchema)
});

// ========== 触发日报生成接口 ==========

export const TriggerReportGenerateInputSchema = z.object({
    type: z.enum(["half-daily", "weekly", "monthly"]),
    // 可选：自定义时间范围（毫秒时间戳），如果不传则使用默认值
    timeStart: z.number().optional(),
    timeEnd: z.number().optional()
});

export const TriggerReportGenerateOutputSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    reportId: z.string().optional() // 生成成功时返回日报 ID
});

// ========== 发送日报邮件接口 ==========

export const SendReportEmailInputSchema = z.object({
    reportId: z.string().min(1, "reportId 不能为空")
});

export const SendReportEmailOutputSchema = z.object({
    success: z.boolean(),
    message: z.string()
});

// ========== Agent 问答接口 ==========

export const AgentAskInputSchema = z.object({
    question: z.string().min(1, "问题不能为空"),
    conversationId: z.string().optional(),
    sessionId: z.string().optional(),
    enabledTools: z.array(z.enum(["rag_search", "sql_query", "web_search"])).default(["rag_search", "sql_query"]),
    maxToolRounds: z.number().int().positive().default(5),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().int().positive().default(2048)
});

export const AgentStreamChunkSchema = z.object({
    type: z.enum(["content", "tool_start", "tool_result", "done", "error"]),
    content: z.string().optional(),
    toolName: z.string().optional(),
    toolParams: z.record(z.unknown()).optional(),
    toolResult: z.unknown().optional(),
    error: z.string().optional(),
    isFinished: z.boolean().optional(),
    usage: z
        .object({
            promptTokens: z.number(),
            completionTokens: z.number(),
            totalTokens: z.number()
        })
        .optional()
});

export const AgentAskOutputSchema = z.object({
    conversationId: z.string(),
    messageId: z.string(),
    content: z.string(),
    toolsUsed: z.array(z.string()),
    toolRounds: z.number(),
    totalUsage: z
        .object({
            promptTokens: z.number(),
            completionTokens: z.number(),
            totalTokens: z.number()
        })
        .optional()
});

// ========== 导出类型 ==========

export type SearchInput = z.infer<typeof SearchInputSchema>;
export type SearchResultItem = z.infer<typeof SearchResultItemSchema>;
export type SearchOutput = z.infer<typeof SearchOutputSchema>;

export type AskInput = z.infer<typeof AskInputSchema>;
export type ReferenceItem = z.infer<typeof ReferenceItemSchema>;
export type AskOutput = z.infer<typeof AskOutputSchema>;

export type TriggerReportGenerateInput = z.infer<typeof TriggerReportGenerateInputSchema>;
export type TriggerReportGenerateOutput = z.infer<typeof TriggerReportGenerateOutputSchema>;

export type SendReportEmailInput = z.infer<typeof SendReportEmailInputSchema>;
export type SendReportEmailOutput = z.infer<typeof SendReportEmailOutputSchema>;

export type AgentAskInput = z.infer<typeof AgentAskInputSchema>;
export type AgentStreamChunk = z.infer<typeof AgentStreamChunkSchema>;
export type AgentAskOutput = z.infer<typeof AgentAskOutputSchema>;
