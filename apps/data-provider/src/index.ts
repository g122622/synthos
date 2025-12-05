import Logger from "@root/common/util/Logger";
import { QQProvider } from "./providers/QQProvider";
import { IMDBManager } from "@root/common/database/IMDBManager";
import { getHoursAgoTimestamp, getMinutesAgoTimestamp } from "@root/common/util/TimeUtils";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { TaskHandlerTypes, TaskParameters } from "@root/common/scheduler/@types/Tasks";
import { IMTypes } from "@root/common/contracts/data-provider";
import { IIMProvider } from "./providers/contracts/IIMProvider";
import ConfigManagerService from "@root/common/config/ConfigManagerService";

(async () => {
    const LOGGER = Logger.withTag("🌏 data-provider-root-script");

    const imdbManager = new IMDBManager();
    await imdbManager.init();

    let config = await ConfigManagerService.getCurrentConfig();

    await agendaInstance
        .create(TaskHandlerTypes.ProvideData)
        .unique({ name: TaskHandlerTypes.ProvideData }, { insertOnly: true })
        .save();
    agendaInstance.define<TaskParameters<TaskHandlerTypes.ProvideData>>(
        TaskHandlerTypes.ProvideData,
        async job => {
            LOGGER.info(`😋开始处理任务: ${job.attrs.name}`);
            const attrs = job.attrs.data;
            config = await ConfigManagerService.getCurrentConfig(); // 刷新配置

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
            for (const groupId of attrs.groupIds) {
                // 计算开始时间
                const latestMessage = await imdbManager.getNewestRawChatMessageByGroupId(groupId);
                let startTime = latestMessage?.timestamp
                    ? latestMessage.timestamp - 60 * 1000
                    : getHoursAgoTimestamp(3 * 24);
                if (!latestMessage?.timestamp) {
                    LOGGER.warning(`群 ${groupId} 没有找到最新消息，使用默认时间范围`);
                }
                if (Date.now() - startTime > 3 * 24 * 60 * 60 * 1000) {
                    LOGGER.warning(`群 ${groupId} 的最新消息时间超过3天，使用默认时间范围。最新消息时间：${latestMessage?.timestamp}`);
                    startTime = getHoursAgoTimestamp(3 * 24);
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

            await agendaInstance.now(TaskHandlerTypes.DecideAndDispatchPreprocess);
            LOGGER.success(`🥳任务完成: ${job.attrs.name}`);
        },
        {
            concurrency: 1,
            priority: "high",
            lockLifetime: 10 * 60 * 1000 // 10分钟
        }
    );

    await agendaInstance
        .create(TaskHandlerTypes.DecideAndDispatchProvideData)
        .unique({ name: TaskHandlerTypes.DecideAndDispatchProvideData }, { insertOnly: true })
        .save();
    agendaInstance.define<TaskParameters<TaskHandlerTypes.DecideAndDispatchProvideData>>(
        TaskHandlerTypes.DecideAndDispatchProvideData,
        async job => {
            LOGGER.info(`😋开始处理任务: ${job.attrs.name}`);
            config = await ConfigManagerService.getCurrentConfig(); // 刷新配置
            // call provideData task
            await agendaInstance.now(TaskHandlerTypes.ProvideData, {
                IMType: IMTypes.QQ,
                groupIds: Object.keys(config.groupConfigs) // TODO 支持wechat之后，需要修改这里
            });

            LOGGER.success(`🥳任务完成: ${job.attrs.name}`);
        }
    );

    // 每隔一段时间触发一次DecideAndDispatchProvideData任务
    LOGGER.debug(
        `DecideAndDispatchProvideData任务将每隔${config.dataProviders.agendaTaskIntervalInMinutes}分钟执行一次`
    );
    await agendaInstance.every(
        config.dataProviders.agendaTaskIntervalInMinutes + " minutes",
        TaskHandlerTypes.DecideAndDispatchProvideData
    );
    await agendaInstance.now(TaskHandlerTypes.DecideAndDispatchProvideData);

    LOGGER.success("Ready to start agenda scheduler");
    await agendaInstance.start(); // 👈 启动调度器
})();
