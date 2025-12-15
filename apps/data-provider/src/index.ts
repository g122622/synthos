import "reflect-metadata";
import Logger from "@root/common/util/Logger";
import { QQProvider } from "./providers/QQProvider/QQProvider";
import { IMDBManager } from "@root/common/database/IMDBManager";
import { getHoursAgoTimestamp } from "@root/common/util/TimeUtils";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { TaskHandlerTypes, TaskParameters } from "@root/common/scheduler/@types/Tasks";
import { IMTypes } from "@root/common/contracts/data-provider/index";
import { IIMProvider } from "./providers/contracts/IIMProvider";
import { registerConfigManagerService, getConfigManagerService } from "@root/common/di/container";

(async () => {
    // 初始化 DI 容器
    registerConfigManagerService();
    const configManagerService = getConfigManagerService();

    const LOGGER = Logger.withTag("🌏 data-provider-root-script");

    const imdbManager = new IMDBManager();
    await imdbManager.init();

    let config = await configManagerService.getCurrentConfig();

    await agendaInstance
        .create(TaskHandlerTypes.ProvideData)
        .unique({ name: TaskHandlerTypes.ProvideData }, { insertOnly: true })
        .save();
    agendaInstance.define<TaskParameters<TaskHandlerTypes.ProvideData>>(
        TaskHandlerTypes.ProvideData,
        async job => {
            LOGGER.info(`😋开始处理任务: ${job.attrs.name}`);
            const attrs = job.attrs.data;
            config = await configManagerService.getCurrentConfig(); // 刷新配置

            // 根据 IM 类型初始化对应的 IM 提供者
            let activeProvider: IIMProvider;
            switch (attrs.IMType) {
                case IMTypes.QQ: {
                    activeProvider = new QQProvider();
                    break;
                }
                default: {
                    LOGGER.error(`Unknown IM type: ${attrs.IMType}`);
                    job.fail("Unknown IM type");
                    return;
                }
            }

            await activeProvider.init();
            LOGGER.debug(`IM provider initialized for ${attrs.IMType}`);
            for (const groupId of attrs.groupIds) {
                LOGGER.debug(`开始获取群 ${groupId} 的消息`);
                // 计算开始时间
                const latestMessage = await imdbManager.getNewestRawChatMessageByGroupId(groupId);
                let startTime = latestMessage?.timestamp
                    ? latestMessage.timestamp - 60 * 1000
                    : getHoursAgoTimestamp(attrs.startTimeInHoursFromNow);
                if (!latestMessage?.timestamp) {
                    LOGGER.warning(`群 ${groupId} 没有找到最新消息，使用默认时间范围`);
                }
                if (Date.now() - startTime > attrs.startTimeInHoursFromNow * 60 * 60 * 1000) {
                    LOGGER.warning(`群 ${groupId} 的最新消息时间超过${attrs.startTimeInHoursFromNow}小时，使用该范围。最新消息时间：${latestMessage?.timestamp}`);
                    startTime = getHoursAgoTimestamp(attrs.startTimeInHoursFromNow);
                }

                const results = await activeProvider.getMsgByTimeRange(
                    startTime, // 从最新消息往前1分钟的数据
                    Date.now(),
                    groupId
                );
                LOGGER.success(`群 ${groupId} 成功获取到 ${results.length} 条有效消息`);
                await imdbManager.storeRawChatMessages(results);
                await job.touch(); // 保证任务存活
            }
            await activeProvider.dispose();

            LOGGER.success(`🥳任务完成: ${job.attrs.name}`);
        },
        {
            concurrency: 1,
            priority: "high",
            lockLifetime: 10 * 60 * 1000 // 10分钟
        }
    );

    LOGGER.success("Ready to start agenda scheduler");
    await agendaInstance.start(); // 👈 启动调度器
})();
