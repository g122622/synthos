/**
 * 请求参数 Schema 定义
 */
import { z } from "zod";

// ==================== Chat Message ====================

export const GetChatMessagesByGroupIdSchema = z.object({
    groupId: z.string({ message: "缺少必要的参数: groupId" }),
    timeStart: z.string({ message: "缺少必要的参数: timeStart" }),
    timeEnd: z.string({ message: "缺少必要的参数: timeEnd" })
});
export type GetChatMessagesByGroupIdParams = z.infer<typeof GetChatMessagesByGroupIdSchema>;

export const GetSessionIdsByGroupIdsAndTimeRangeSchema = z.object({
    groupIds: z.array(z.string(), { message: "缺少必要的参数: groupIds" }),
    timeStart: z.union([z.string(), z.number()], { message: "缺少必要的参数: timeStart" }),
    timeEnd: z.union([z.string(), z.number()], { message: "缺少必要的参数: timeEnd" })
});
export type GetSessionIdsByGroupIdsAndTimeRangeParams = z.infer<typeof GetSessionIdsByGroupIdsAndTimeRangeSchema>;

export const GetSessionTimeDurationsSchema = z.object({
    sessionIds: z.array(z.string(), { message: "缺少sessionIds参数" })
});
export type GetSessionTimeDurationsParams = z.infer<typeof GetSessionTimeDurationsSchema>;

// ==================== AI Digest ====================

export const GetAIDigestResultByTopicIdSchema = z.object({
    topicId: z.string({ message: "缺少topicId参数" })
});
export type GetAIDigestResultByTopicIdParams = z.infer<typeof GetAIDigestResultByTopicIdSchema>;

export const GetAIDigestResultsBySessionIdsSchema = z.object({
    sessionIds: z.array(z.string(), { message: "缺少sessionIds参数" })
});
export type GetAIDigestResultsBySessionIdsParams = z.infer<typeof GetAIDigestResultsBySessionIdsSchema>;

export const CheckSessionSummarizedSchema = z.object({
    sessionId: z.string({ message: "缺少sessionId参数" })
});
export type CheckSessionSummarizedParams = z.infer<typeof CheckSessionSummarizedSchema>;

// ==================== Interest Score ====================

export const GetInterestScoreResultsSchema = z.object({
    topicIds: z.array(z.string(), { message: "缺少topicIds参数" })
});
export type GetInterestScoreResultsParams = z.infer<typeof GetInterestScoreResultsSchema>;

// ==================== Topic Status ====================

export const TopicIdSchema = z.object({
    topicId: z.string({ message: "缺少topicId参数或参数类型不正确" })
});
export type TopicIdParams = z.infer<typeof TopicIdSchema>;

export const TopicIdsSchema = z.object({
    topicIds: z.array(z.string(), { message: "缺少topicIds参数或参数类型不正确" })
});
export type TopicIdsParams = z.infer<typeof TopicIdsSchema>;

// ==================== Misc ====================

export const GetQQAvatarSchema = z.object({
    qqNumber: z.string({ message: "缺少qqNumber参数" })
});
export type GetQQAvatarParams = z.infer<typeof GetQQAvatarSchema>;

// ==================== RAG Chat History ====================

export const CreateRagSessionSchema = z.object({
    question: z.string({ message: "缺少question参数" }),
    answer: z.string({ message: "缺少answer参数" }),
    references: z.array(z.object({
        topicId: z.string(),
        topic: z.string(),
        relevance: z.number()
    }), { message: "缺少references参数" }),
    topK: z.number({ message: "缺少topK参数" })
});
export type CreateRagSessionParams = z.infer<typeof CreateRagSessionSchema>;

export const GetRagSessionListSchema = z.object({
    limit: z.number({ message: "缺少limit参数" }).int().positive().max(100),
    offset: z.number({ message: "缺少offset参数" }).int().min(0)
});
export type GetRagSessionListParams = z.infer<typeof GetRagSessionListSchema>;

export const RagSessionIdSchema = z.object({
    sessionId: z.string({ message: "缺少sessionId参数" })
});
export type RagSessionIdParams = z.infer<typeof RagSessionIdSchema>;

export const UpdateRagSessionTitleSchema = z.object({
    sessionId: z.string({ message: "缺少sessionId参数" }),
    title: z.string({ message: "缺少title参数" })
});
export type UpdateRagSessionTitleParams = z.infer<typeof UpdateRagSessionTitleSchema>;

// ==================== Report ====================

export const GetReportByIdSchema = z.object({
    reportId: z.string({ message: "缺少reportId参数" })
});
export type GetReportByIdParams = z.infer<typeof GetReportByIdSchema>;

export const GetReportsPaginatedSchema = z.object({
    page: z.number({ message: "缺少page参数" }).int().positive(),
    pageSize: z.number({ message: "缺少pageSize参数" }).int().positive().max(50),
    type: z.enum(["half-daily", "weekly", "monthly"]).optional()
});
export type GetReportsPaginatedParams = z.infer<typeof GetReportsPaginatedSchema>;

export const GetReportsByDateSchema = z.object({
    date: z.union([z.string(), z.number()], { message: "缺少date参数" })
});
export type GetReportsByDateParams = z.infer<typeof GetReportsByDateSchema>;

export const GetReportsByTimeRangeSchema = z.object({
    timeStart: z.number({ message: "缺少timeStart参数" }),
    timeEnd: z.number({ message: "缺少timeEnd参数" }),
    type: z.enum(["half-daily", "weekly", "monthly"]).optional()
});
export type GetReportsByTimeRangeParams = z.infer<typeof GetReportsByTimeRangeSchema>;

export const GetRecentReportsSchema = z.object({
    type: z.enum(["half-daily", "weekly", "monthly"], { message: "缺少type参数" }),
    limit: z.number({ message: "缺少limit参数" }).int().positive().max(50)
});
export type GetRecentReportsParams = z.infer<typeof GetRecentReportsSchema>;

export const TriggerReportGenerateSchema = z.object({
    type: z.enum(["half-daily", "weekly", "monthly"], { message: "缺少type参数" }),
    timeStart: z.number().optional(),
    timeEnd: z.number().optional()
});
export type TriggerReportGenerateParams = z.infer<typeof TriggerReportGenerateSchema>;

