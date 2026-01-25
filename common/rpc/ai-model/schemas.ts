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

export const AskStreamChunkSchema = z.object({
    type: z.enum(["content", "references", "done", "error"]),
    content: z.string().optional(),
    references: z.array(ReferenceItemSchema).optional(),
    error: z.string().optional(),

    // 由 WebUI-Backend 在流式结束后落库并回传，前端可据此自动选中新会话
    sessionId: z.string().optional(),

    // 失败标记：用于“保存部分内容并标记失败”场景
    isFailed: z.boolean().optional(),
    failReason: z.string().optional()
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

// ==================== Agent SSE 事件协议（稳定业务事件）====================

export const AgentTokenUsageSchema = z.object({
    promptTokens: z.number(),
    completionTokens: z.number(),
    totalTokens: z.number()
});

export const AgentEventBaseSchema = z.object({
    // 统一使用 UNIX 毫秒级时间戳
    ts: z.number(),
    // conversationId 对应 LangGraph thread_id
    conversationId: z.string()
});

export const AgentTokenEventSchema = AgentEventBaseSchema.extend({
    type: z.literal("token"),
    content: z.string()
});

export const AgentToolCallEventSchema = AgentEventBaseSchema.extend({
    type: z.literal("tool_call"),
    toolCallId: z.string(),
    toolName: z.string(),
    toolArgs: z.unknown()
});

export const AgentToolResultEventSchema = AgentEventBaseSchema.extend({
    type: z.literal("tool_result"),
    toolCallId: z.string(),
    toolName: z.string(),
    result: z.unknown()
});

export const AgentDoneEventSchema = AgentEventBaseSchema.extend({
    type: z.literal("done"),
    messageId: z.string().optional(),
    content: z.string().optional(),
    toolsUsed: z.array(z.string()).optional(),
    toolRounds: z.number().optional(),
    totalUsage: AgentTokenUsageSchema.optional()
});

export const AgentErrorEventSchema = AgentEventBaseSchema.extend({
    type: z.literal("error"),
    error: z.string()
});

export const AgentEventSchema = z.discriminatedUnion("type", [
    AgentTokenEventSchema,
    AgentToolCallEventSchema,
    AgentToolResultEventSchema,
    AgentDoneEventSchema,
    AgentErrorEventSchema
]);

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

// ==================== Agent time-travel / state history ====================

export const AgentGetStateHistoryInputSchema = z.object({
    conversationId: z.string().min(1, "conversationId 不能为空"),
    limit: z.number().int().positive().max(100).default(20),
    beforeCheckpointId: z.string().optional()
});

export const AgentStateHistoryItemSchema = z.object({
    checkpointId: z.string(),
    createdAt: z.number(),
    next: z.array(z.string()),
    metadata: z.unknown().optional()
});

export const AgentGetStateHistoryOutputSchema = z.object({
    items: z.array(AgentStateHistoryItemSchema),
    nextCursor: z.string().optional()
});

export const AgentForkFromCheckpointInputSchema = z.object({
    conversationId: z.string().min(1, "conversationId 不能为空"),
    checkpointId: z.string().min(1, "checkpointId 不能为空"),
    newConversationId: z.string().optional()
});

export const AgentForkFromCheckpointOutputSchema = z.object({
    conversationId: z.string()
});

// ========== Agent 历史分页接口 ==========

export const AgentConversationItemSchema = z.object({
    id: z.string(),
    sessionId: z.string().optional(),
    title: z.string(),
    createdAt: z.number(),
    updatedAt: z.number()
});

export const AgentMessageItemSchema = z.object({
    id: z.string(),
    conversationId: z.string(),
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
    timestamp: z.number(),
    toolsUsed: z.string().optional(),
    toolRounds: z.number().optional(),
    tokenUsage: z.string().optional()
});

export const AgentGetConversationsInputSchema = z.object({
    sessionId: z.string().optional(),
    beforeUpdatedAt: z.number().optional(),
    limit: z.number().int().positive().default(20)
});

export const AgentGetMessagesInputSchema = z.object({
    conversationId: z.string().min(1, "conversationId 不能为空"),
    beforeTimestamp: z.number().optional(),
    limit: z.number().int().positive().default(20)
});

export const AgentGetConversationsOutputSchema = z.array(AgentConversationItemSchema);
export const AgentGetMessagesOutputSchema = z.array(AgentMessageItemSchema);

// ========== 导出类型 ==========

export type SearchInput = z.infer<typeof SearchInputSchema>;
export type SearchResultItem = z.infer<typeof SearchResultItemSchema>;
export type SearchOutput = z.infer<typeof SearchOutputSchema>;

export type AskInput = z.infer<typeof AskInputSchema>;
export type ReferenceItem = z.infer<typeof ReferenceItemSchema>;
export type AskOutput = z.infer<typeof AskOutputSchema>;
export type AskStreamChunk = z.infer<typeof AskStreamChunkSchema>;

export type TriggerReportGenerateInput = z.infer<typeof TriggerReportGenerateInputSchema>;
export type TriggerReportGenerateOutput = z.infer<typeof TriggerReportGenerateOutputSchema>;

export type SendReportEmailInput = z.infer<typeof SendReportEmailInputSchema>;
export type SendReportEmailOutput = z.infer<typeof SendReportEmailOutputSchema>;

export type AgentAskInput = z.infer<typeof AgentAskInputSchema>;
export type AgentTokenUsage = z.infer<typeof AgentTokenUsageSchema>;
export type AgentEvent = z.infer<typeof AgentEventSchema>;
export type AgentAskOutput = z.infer<typeof AgentAskOutputSchema>;

export type AgentGetStateHistoryInput = z.infer<typeof AgentGetStateHistoryInputSchema>;
export type AgentStateHistoryItem = z.infer<typeof AgentStateHistoryItemSchema>;
export type AgentGetStateHistoryOutput = z.infer<typeof AgentGetStateHistoryOutputSchema>;
export type AgentForkFromCheckpointInput = z.infer<typeof AgentForkFromCheckpointInputSchema>;
export type AgentForkFromCheckpointOutput = z.infer<typeof AgentForkFromCheckpointOutputSchema>;

export type AgentConversationItem = z.infer<typeof AgentConversationItemSchema>;
export type AgentMessageItem = z.infer<typeof AgentMessageItemSchema>;
export type AgentGetConversationsInput = z.infer<typeof AgentGetConversationsInputSchema>;
export type AgentGetMessagesInput = z.infer<typeof AgentGetMessagesInputSchema>;
export type AgentGetConversationsOutput = z.infer<typeof AgentGetConversationsOutputSchema>;
export type AgentGetMessagesOutput = z.infer<typeof AgentGetMessagesOutputSchema>;
