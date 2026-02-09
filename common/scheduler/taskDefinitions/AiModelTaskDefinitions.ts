import type { TaskMetadata } from "../registry/types";

import { z } from "zod";

import { getHoursAgoTimestamp } from "../../util/TimeUtils";
import { GroupIdsSchema } from "../schemas/composables/GroupIdsSchema";
import { TimeRangeSchema } from "../schemas/composables/TimeRangeSchema";

/**
 * 通用：带群组与时间范围的任务参数 Schema
 */
export const GroupedTimeRangeParamsSchema = z.object({
    ...GroupIdsSchema.shape,
    ...TimeRangeSchema.shape
});

export type GroupedTimeRangeParams = z.infer<typeof GroupedTimeRangeParamsSchema>;

export const AISummarizeTaskDefinition: TaskMetadata<GroupedTimeRangeParams> = {
    internalName: "AISummarize",
    displayName: "AI 摘要生成",
    description: "对群聊消息进行 AI 摘要生成",
    paramsSchema: GroupedTimeRangeParamsSchema,
    generateDefaultParams: async (context, config) => {
        return {
            groupIds: Object.keys(config.groupConfigs),
            startTimeStamp: getHoursAgoTimestamp(config.orchestrator.dataSeekTimeWindowInHours),
            endTimeStamp: Date.now()
        };
    }
};

export const GenerateEmbeddingTaskDefinition: TaskMetadata<GroupedTimeRangeParams> = {
    internalName: "GenerateEmbedding",
    displayName: "生成向量嵌入",
    description: "为 AI 摘要结果生成向量嵌入",
    paramsSchema: GroupedTimeRangeParamsSchema,
    generateDefaultParams: async (context, config) => {
        return {
            groupIds: Object.keys(config.groupConfigs),
            startTimeStamp: getHoursAgoTimestamp(config.orchestrator.dataSeekTimeWindowInHours),
            endTimeStamp: Date.now()
        };
    }
};

export const InterestScoreTaskDefinition: TaskMetadata<GroupedTimeRangeParams> = {
    internalName: "InterestScore",
    displayName: "兴趣度评分",
    description: "对 AI 摘要结果进行兴趣度评分",
    paramsSchema: GroupedTimeRangeParamsSchema,
    generateDefaultParams: async (context, config) => {
        return {
            groupIds: Object.keys(config.groupConfigs),
            startTimeStamp: getHoursAgoTimestamp(config.orchestrator.dataSeekTimeWindowInHours),
            endTimeStamp: Date.now()
        };
    }
};

export const LLMInterestEvaluationAndNotificationTaskDefinition: TaskMetadata<GroupedTimeRangeParams> = {
    internalName: "LLMInterestEvaluationAndNotification",
    displayName: "LLM 兴趣评估与通知",
    description: "使用 LLM 评估话题兴趣并通过邮件通知",
    paramsSchema: GroupedTimeRangeParamsSchema,
    generateDefaultParams: async (context, config) => {
        return {
            groupIds: Object.keys(config.groupConfigs),
            startTimeStamp: getHoursAgoTimestamp(config.orchestrator.dataSeekTimeWindowInHours),
            endTimeStamp: Date.now()
        };
    }
};

export const GenerateReportParamsSchema = z.object({
    reportType: z.enum(["half-daily", "weekly", "monthly"]).describe("日报类型"),
    timeStart: z.number().int().positive().describe("时间范围起始（毫秒）"),
    timeEnd: z.number().int().positive().describe("时间范围结束（毫秒）")
});

export type GenerateReportParams = z.infer<typeof GenerateReportParamsSchema>;

export const GenerateReportTaskDefinition: TaskMetadata<GenerateReportParams> = {
    internalName: "GenerateReport",
    displayName: "生成日报",
    description: "生成半日报/周报/月报",
    paramsSchema: GenerateReportParamsSchema,
    generateDefaultParams: async () => {
        const now = Date.now();

        return {
            reportType: "half-daily",
            timeStart: now - 12 * 60 * 60 * 1000,
            timeEnd: now
        };
    }
};
