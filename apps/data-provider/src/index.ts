import Logger from "@root/common/util/Logger";
import { QQProvider } from "./providers/QQProvider";
import { IMDBManager } from "@root/common/database/IMDBManager";
import { getMinutesAgoTimestamp } from "@root/common/util/TimeUtils";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { TaskHandlerTypes, TaskParameters } from "@root/common/scheduler/@types/Tasks";
import { IMTypes } from "@root/common/types/data-provider";
import { IIMProvider } from "./providers/@types/IIMProvider";
import ConfigManagerService from "@root/common/config/ConfigManagerService";

(async () => {
    const LOGGER = Logger.withTag("data-provider-root-script");

    const imdbManager = new IMDBManager();
    await imdbManager.init();

    let config = await ConfigManagerService.getCurrentConfig();

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
                const results = await activeProvider.getMsgByTimeRange(attrs.startTimeStamp, attrs.endTimeStamp, groupId);
                LOGGER.success(`群 ${groupId} 成功获取到 ${results.length} 条有效消息`);
                await imdbManager.storeRawChatMessages(results);
                await job.touch(); // 保证任务存活
            }
            await activeProvider.close();
            LOGGER.success(`🥳任务完成: ${job.attrs.name}`);
        },
        {
            concurrency: 1,
            priority: "high",
            lockLifetime: 10 * 60 * 1000, // 10分钟
        }
    );

    agendaInstance.define<TaskParameters<TaskHandlerTypes.DecideAndDispatchProvideData>>(
        TaskHandlerTypes.DecideAndDispatchProvideData,
        async job => {
            LOGGER.info(`😋开始处理任务: ${job.attrs.name}`);
            // call provideData task
            await agendaInstance.schedule("1 second", TaskHandlerTypes.ProvideData, {
                IMType: IMTypes.QQ,
                groupIds: Object.keys(config.groupConfigs), // TODO 支持wechat之后，需要修改这里
                // 这里多请求1分钟的数据，是为了避免数据遗漏
                startTimeStamp: getMinutesAgoTimestamp(config.dataProviders.agendaTaskIntervalInMinutes + 1),
                endTimeStamp: Date.now()
            });

            LOGGER.success(`🥳任务完成: ${job.attrs.name}`);
        }
    );

    // 每隔一段时间触发一次DecideAndDispatchProvideData任务
    LOGGER.debug(`DecideAndDispatchProvideData任务将每隔${config.dataProviders.agendaTaskIntervalInMinutes}分钟执行一次`);
    await agendaInstance.every(
        config.dataProviders.agendaTaskIntervalInMinutes + " minutes",
        TaskHandlerTypes.DecideAndDispatchProvideData
    );

    LOGGER.success("Ready to start agenda scheduler");
    await agendaInstance.start(); // 👈 启动调度器
})();
