import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import { z } from "zod";
import Logger from "@root/common/util/Logger";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { registerTask } from "@root/common/scheduler/registry/index";
import { IMTypes } from "@root/common/contracts/data-provider/index";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import { GroupIdsSchema } from "@root/common/scheduler/schemas/composables/GroupIdsSchema";
import { TimeRangeSchema } from "@root/common/scheduler/schemas/composables/TimeRangeSchema";
import { Runnable } from "@root/common/util/type/Runnable";

import { IIMProvider } from "../providers/contracts/IIMProvider";
import { COMMON_TOKENS } from "../di/tokens";
import { getQQProvider } from "../di/container";

/**
 * 数据提供任务处理器
 * 负责从各种 IM 平台获取消息并存储到数据库
 */
@injectable()
@registerTask({
    internalName: "ProvideData",
    displayName: "提供初始数据",
    description: "从 IM 平台获取聊天消息并存储到数据库",
    paramsSchema: z.object({
        /** IM 类型 */
        IMType: z.enum(["QQ", "WeChat"]),
        /** 群组 ID 列表 */
        ...GroupIdsSchema.shape,
        /** 起始时间戳（毫秒） */
        ...TimeRangeSchema.shape
    }),
    generateDefaultParams: async (context, config) => {
        const now = Date.now();
        const defaultTimeRange = config.orchestrator?.defaultTimeRangeInHours ?? 24;

        return {
            IMType: config.orchestrator?.defaultIMType ?? "QQ",
            groupIds: config.orchestrator?.defaultGroupIds ?? [],
            startTimeStamp: now - defaultTimeRange * 60 * 60 * 1000,
            endTimeStamp: now
        };
    }
})
export class ProvideDataTaskHandler implements Runnable {
    private LOGGER = Logger.withTag("🌏 ProvideDataTask");

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
    public async run(): Promise<void> {
        await agendaInstance
            .create(TaskHandlerTypes.ProvideData)
            .unique({ name: TaskHandlerTypes.ProvideData }, { insertOnly: true })
            .save();

        agendaInstance.define<TaskParameters<TaskHandlerTypes.ProvideData>>(
            TaskHandlerTypes.ProvideData,
            async job => {
                this.LOGGER.info(`😋开始处理任务: ${job.attrs.name}`);
                const attrs = job.attrs.data;

                // 根据 IM 类型从 DI 容器获取对应的 IM 提供者
                let activeProvider: IIMProvider;

                switch (attrs.IMType) {
                    case IMTypes.QQ: {
                        activeProvider = getQQProvider();
                        break;
                    }
                    default: {
                        this.LOGGER.error(`Unknown IM type: ${attrs.IMType}`);
                        job.fail("Unknown IM type");

                        return;
                    }
                }

                await activeProvider.init();
                this.LOGGER.debug(`IM provider initialized for ${attrs.IMType}`);

                for (const groupId of attrs.groupIds) {
                    this.LOGGER.debug(`开始获取群 ${groupId} 的消息`);

                    const results = await activeProvider.getMsgByTimeRange(
                        attrs.startTimeStamp < 0 // 如果是负数则代表自动获取时间范围
                            ? (await this.imDbAccessService.getNewestRawChatMessageByGroupId(groupId)).timestamp -
                                  1000 // 避免漏掉最后一条消息，回溯1秒
                            : attrs.startTimeStamp,
                        attrs.endTimeStamp,
                        groupId
                    );

                    this.LOGGER.success(`群 ${groupId} 成功获取到 ${results.length} 条有效消息`);
                    await this.imDbAccessService.storeRawChatMessages(results);
                    await job.touch(); // 保证任务存活
                }
                await activeProvider.dispose();

                this.LOGGER.success(`🥳任务完成: ${job.attrs.name}`);
            },
            {
                concurrency: 1,
                priority: "high",
                lockLifetime: 10 * 60 * 1000 // 10分钟
            }
        );
    }
}
