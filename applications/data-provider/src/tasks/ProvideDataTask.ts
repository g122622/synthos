import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import Logger from "@root/common/util/Logger";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { TaskHandlerTypes, TaskParameters } from "@root/common/scheduler/@types/Tasks";
import { IMTypes } from "@root/common/contracts/data-provider/index";
import { IIMProvider } from "../providers/contracts/IIMProvider";
import { COMMON_TOKENS } from "../di/tokens";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import { getQQProvider } from "../di/container";

/**
 * 数据提供任务处理器
 * 负责从各种 IM 平台获取消息并存储到数据库
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
        let config = await this.configManagerService.getCurrentConfig();

        await agendaInstance
            .create(TaskHandlerTypes.ProvideData)
            .unique({ name: TaskHandlerTypes.ProvideData }, { insertOnly: true })
            .save();

        agendaInstance.define<TaskParameters<TaskHandlerTypes.ProvideData>>(
            TaskHandlerTypes.ProvideData,
            async job => {
                this.LOGGER.info(`😋开始处理任务: ${job.attrs.name}`);
                const attrs = job.attrs.data;
                config = await this.configManagerService.getCurrentConfig(); // 刷新配置

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
