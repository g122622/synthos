import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import Logger from "@root/common/util/Logger";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { TaskHandlerTypes, TaskParameters } from "@root/common/scheduler/@types/Tasks";
import { IMTypes, RawChatMessage } from "@root/common/contracts/data-provider/index";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";

import { IIMProvider } from "../providers/contracts/IIMProvider";
import { COMMON_TOKENS } from "../di/tokens";
import { getQQProvider } from "../di/container";

/**
 * 数据提供任务处理器
 * 负责从各种 IM 平台获取消息并存储到数据库
 * 使用并发查询，多个群组同时获取消息
 */
@injectable()
export class ProvideDataTaskHandler {
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
    public async register(): Promise<void> {
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
                this.LOGGER.info(`IM provider initialized for ${attrs.IMType}`);

                // 并发处理所有群组的消息获取
                const groupPromises = attrs.groupIds.map(async (groupId: string) => {
                    this.LOGGER.debug(`开始获取群 ${groupId} 的消息`);

                    let results: RawChatMessage[] = [];

                    if (attrs.startTimeStamp < 0) {
                        const newestMsg = await this.imDbAccessService.getNewestRawChatMessageByGroupId(groupId);
                        const startTimeStamp = newestMsg ? newestMsg.timestamp - 1000 : 0;

                        results = await activeProvider.getMsgByTimeRange(
                            startTimeStamp,
                            attrs.endTimeStamp,
                            groupId
                        );
                    } else {
                        results = await activeProvider.getMsgByTimeRange(
                            attrs.startTimeStamp,
                            attrs.endTimeStamp,
                            groupId
                        );
                    }

                    this.LOGGER.success(`群 ${groupId} 成功获取到 ${results.length} 条有效消息`);

                    return { groupId, results };
                });

                const settled = await Promise.allSettled(groupPromises);

                for (const result of settled) {
                    if (result.status === "fulfilled") {
                        await this.imDbAccessService.storeRawChatMessages(result.value.results);
                    } else {
                        this.LOGGER.error(`群消息获取失败: ${result.reason}`);
                    }
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
