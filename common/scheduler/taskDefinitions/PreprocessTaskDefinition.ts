import type { TaskMetadata } from "../registry/types";

import { z } from "zod";

import { getHoursAgoTimestamp } from "../../util/TimeUtils";
import { GroupIdsSchema } from "../schemas/composables/GroupIdsSchema";
import { TimeRangeSchema } from "../schemas/composables/TimeRangeSchema";

/**
 * Preprocess 任务参数 Schema
 */
export const PreprocessParamsSchema = z.object({
    /** 群组 ID 列表 */
    ...GroupIdsSchema.shape,
    /** 起始时间戳（毫秒） */
    ...TimeRangeSchema.shape
});

export type PreprocessParams = z.infer<typeof PreprocessParamsSchema>;

/**
 * Preprocess 任务定义（仅包含元数据与参数 Schema）
 */
export const PreprocessTaskDefinition: TaskMetadata<PreprocessParams> = {
    internalName: "Preprocess",
    displayName: "消息预处理",
    description: "对群聊消息进行分割和 session 分配",
    paramsSchema: PreprocessParamsSchema,
    generateDefaultParams: async (context, config) => {
        return {
            groupIds: Object.keys(config.groupConfigs),
            startTimeStamp: getHoursAgoTimestamp(config.orchestrator.dataSeekTimeWindowInHours),
            endTimeStamp: Date.now()
        };
    }
};
