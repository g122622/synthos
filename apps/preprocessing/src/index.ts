import { IMDBManager } from "@root/common/database/IMDBManager";
import { getHoursAgoTimestamp } from "@root/common/util/TimeUtils";
import { FixedSplitter } from "./splitters/FixedSplitter";
import Logger from "@root/common/util/Logger";
import { ProcessedChatMessage } from "@root/common/types/data-provider";
import { formatMsg } from "./formatMsg";
import { agendaInstance } from "@root/common/scheduler/agenda";
import ConfigManagerService from "@root/common/config/ConfigManagerService";
import { TaskHandlerTypes, TaskParameters } from "@root/common/scheduler/@types/Tasks";

(async () => {
    const imdbManager = new IMDBManager();
    await imdbManager.init();
    const splitter = new FixedSplitter();
    await splitter.init();

    const results = await imdbManager.getRawChatMessagesByGroupIdAndTimeRange("738075190", getHoursAgoTimestamp(12), Date.now());
    const splitResultMap = await splitter.split(results);
    const preProcessedResults: ProcessedChatMessage[] = [];
    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const sessionId = splitResultMap.get(result.msgId);
        preProcessedResults.push({
            msgId: result.msgId,
            sessionId: sessionId!,
            preProcessedContent: formatMsg(result)
        });
    }
    await imdbManager.storeProcessedChatMessages(preProcessedResults);

    await imdbManager.close();
})();

(async () => {
    const LOGGER = Logger.withTag("preprocessor-root-script");

    const imdbManager = new IMDBManager();
    await imdbManager.init();

    let config = await ConfigManagerService.getCurrentConfig();

    agendaInstance.define<TaskParameters<TaskHandlerTypes.Preprocess>>(
        TaskHandlerTypes.Preprocess,
        async job => {
            LOGGER.info(`😋开始处理任务: ${job.attrs.name}`);
            const attrs = job.attrs.data;
            config = await ConfigManagerService.getCurrentConfig(); // 刷新配置

            let splitResultMap: Map<string, string>;
            for (const groupId of attrs.groupIds) {
                switch (config.groupConfigs[groupId]?.splitStrategy) {
                    case "accumulative": {
                        // TODO 实现
                        break;
                    }
                    case "realtime": {
                        // TODO 实现
                        break;
                    }
                    default: {
                        LOGGER.warning(
                            `未知的分割策略: ${config.groupConfigs[groupId]?.splitStrategy}，使用accumulative策略兜底`
                        );
                        // TODO 实现
                        break;
                    }
                }
            }
            const preProcessedResults: ProcessedChatMessage[] = [];
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                const sessionId = splitResultMap.get(result.msgId);
                preProcessedResults.push({
                    msgId: result.msgId,
                    sessionId: sessionId!,
                    preProcessedContent: formatMsg(result)
                });
            }
            await imdbManager.storeProcessedChatMessages(preProcessedResults);

            await imdbManager.close();
            LOGGER.success(`🥳任务完成: ${job.attrs.name}`);
        },
        {
            concurrency: 3,
            priority: "high"
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
                // 这里多请求3分钟的数据，是为了避免数据遗漏
                startTimeStamp: getMinutesAgoTimestamp(config.dataProviders.agendaTaskIntervalInMinutes + 3),
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
