import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import { z } from "zod";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import Logger from "@root/common/util/Logger";
import { ProcessedChatMessage } from "@root/common/contracts/data-provider";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { Task } from "@root/common/scheduler/registry/index";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import { GroupIdsSchema } from "@root/common/scheduler/schemas/composables/GroupIdsSchema";
import { TimeRangeSchema } from "@root/common/scheduler/schemas/composables/TimeRangeSchema";

import { formatMsg } from "../formatMsg";
import { ISplitter } from "../splitters/contracts/ISplitter";
import { COMMON_TOKENS } from "../di/tokens";
import { getAccumulativeSplitter, getTimeoutSplitter } from "../di/container";

/**
 * 预处理任务参数 Schema
 */
export const PreprocessParamsSchema = z.object({
    /** 群组 ID 列表 */
    ...GroupIdsSchema.shape,
    /** 起始时间戳（毫秒） */
    ...TimeRangeSchema.shape
});
export type PreprocessParams = z.infer<typeof PreprocessParamsSchema>;

/**
 * 预处理任务处理器
 * 负责对消息进行分割和预处理
 */
@injectable()
@Task<PreprocessParams>({
    displayName: "消息预处理",
    description: "对群聊消息进行分割和 session 分配",
    paramsSchema: PreprocessParamsSchema,
    generateDefaultParams: async (context, config) => {
        const now = Date.now();
        const defaultTimeRange = config.orchestrator?.defaultTimeRangeInHours ?? 24;

        return {
            groupIds: config.orchestrator?.defaultGroupIds ?? [],
            startTimeStamp: now - defaultTimeRange * 60 * 60 * 1000,
            endTimeStamp: now
        };
    }
})
export class PreprocessTaskHandler {
    public static readonly TASK_NAME = "Preprocess";
    private LOGGER = Logger.withTag("🏭 PreprocessTask");

    /**
     * 构造函数
     * @param configManagerService 配置管理服务
     * @param imDbAccessService IM 数据库访问服务
     */
    public constructor(
        @inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService,
        @inject(COMMON_TOKENS.ImDbAccessService) private imDbAccessService: ImDbAccessService
    ) {}

    /**
     * 注册任务到 Agenda 调度器
     */
    public async register(): Promise<void> {
        let config = await this.configManagerService.getCurrentConfig();

        await agendaInstance
            .create(TaskHandlerTypes.Preprocess)
            .unique({ name: TaskHandlerTypes.Preprocess }, { insertOnly: true })
            .save();

        agendaInstance.define<TaskParameters<TaskHandlerTypes.Preprocess>>(
            TaskHandlerTypes.Preprocess,
            async job => {
                this.LOGGER.info(`😋开始处理任务: ${job.attrs.name}`);
                const attrs = job.attrs.data;

                config = await this.configManagerService.getCurrentConfig(); // 刷新配置

                for (const groupId of attrs.groupIds) {
                    // 从 DI 容器获取对应的分割器
                    let splitter: ISplitter;

                    switch (config.groupConfigs[groupId]?.splitStrategy) {
                        case "accumulative": {
                            splitter = getAccumulativeSplitter();
                            break;
                        }
                        case "realtime": {
                            splitter = getTimeoutSplitter();
                            break;
                        }
                        default: {
                            this.LOGGER.warning(
                                `未知的分割策略: ${config.groupConfigs[groupId]?.splitStrategy}，使用accumulative策略兜底`
                            );
                            splitter = getAccumulativeSplitter();
                            break;
                        }
                    }

                    // 开始消息分割，分配sessionId
                    await splitter.init();
                    const results = await Promise.all(
                        (await splitter.assignSessionId(groupId, attrs.startTimeStamp, attrs.endTimeStamp)).map<
                            Promise<ProcessedChatMessage>
                        >(async result => {
                            return {
                                sessionId: result.sessionId!,
                                msgId: result.msgId,
                                preProcessedContent: formatMsg(
                                    result,
                                    result.quotedMsgId
                                        ? await this.imDbAccessService.getRawChatMessageByMsgId(result.quotedMsgId)
                                        : undefined,
                                    result.quotedMsgContent
                                )
                            };
                        })
                    );

                    await this.imDbAccessService.storeProcessedChatMessages(results);
                    await splitter.dispose();

                    this.LOGGER.success(`为群${groupId}分配了${results.length}条消息`);
                    await job.touch(); // 保活
                }

                this.LOGGER.success(`🥳任务完成: ${job.attrs.name}`);
            },
            {
                concurrency: 1,
                priority: "high"
            }
        );
    }
}
