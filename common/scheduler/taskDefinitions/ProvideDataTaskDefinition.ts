import type { TaskMetadata } from "../registry/types";

import { z } from "zod";

import { IMTypes } from "../../contracts/data-provider/index";
import { getHoursAgoTimestamp } from "../../util/TimeUtils";
import { GroupIdsSchema } from "../schemas/composables/GroupIdsSchema";
import { TimeRangeSchema } from "../schemas/composables/TimeRangeSchema";

/**
 * ProvideData 任务参数 Schema
 */
export const ProvideDataParamsSchema = z.object({
    /** IM 类型 */
    IMType: z.enum([IMTypes.QQ, IMTypes.WeChat]).describe("IM 平台类型"),
    /** 群组 ID 列表 */
    ...GroupIdsSchema.shape,
    /** 起始时间戳（毫秒） */
    ...TimeRangeSchema.shape
});

export type ProvideDataParams = z.infer<typeof ProvideDataParamsSchema>;

/**
 * ProvideData 任务定义（仅包含元数据与参数 Schema）
 */
export const ProvideDataTaskDefinition: TaskMetadata<ProvideDataParams> = {
    internalName: "ProvideData",
    displayName: "提供初始数据",
    description: "从 IM 平台获取聊天消息并存储到数据库",
    paramsSchema: ProvideDataParamsSchema,
    generateDefaultParams: async (context, config) => {
        const IMType = IMTypes.QQ;
        const groupIds = Object.keys(config.groupConfigs).filter(gid => config.groupConfigs[gid].IM === IMType);

        return {
            IMType,
            groupIds,
            startTimeStamp: getHoursAgoTimestamp(config.orchestrator.dataSeekTimeWindowInHours),
            endTimeStamp: Date.now()
        };
    }
};
