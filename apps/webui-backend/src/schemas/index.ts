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

