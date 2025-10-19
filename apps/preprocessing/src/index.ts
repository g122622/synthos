import { IMDBManager } from "@root/common/database/IMDBManager";
import { AccumulativeSplitter } from "./splitters/AccumulativeSplitter";
import { TimeoutSplitter } from "./splitters/TimeoutSplitter";
import Logger from "@root/common/util/Logger";
import { ProcessedChatMessage } from "@root/common/types/data-provider";
import { formatMsg } from "./formatMsg";
import { agendaInstance } from "@root/common/scheduler/agenda";
import ConfigManagerService from "@root/common/config/ConfigManagerService";
import { TaskHandlerTypes, TaskParameters } from "@root/common/scheduler/@types/Tasks";
import { ISplitter } from "./splitters/@types/ISplitter";

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

            for (const groupId of attrs.groupIds) {
                let splitter: ISplitter;
                switch (config.groupConfigs[groupId]?.splitStrategy) {
                    case "accumulative": {
                        splitter = new AccumulativeSplitter();
                        break;
                    }
                    case "realtime": {
                        splitter = new TimeoutSplitter();
                        break;
                    }
                    default: {
                        LOGGER.warning(
                            `未知的分割策略: ${config.groupConfigs[groupId]?.splitStrategy}，使用accumulative策略兜底`
                        );
                        splitter = new AccumulativeSplitter();
                        // TODO 实现
                        break;
                    }
                }
                await splitter.init();
                const results = (
                    await splitter.assignSessionId(
                        imdbManager,
                        groupId,
                        attrs.startTimeInMinutesFromNow
                    )
                ).map<ProcessedChatMessage>(result => {
                    return {
                        sessionId: result.sessionId!,
                        msgId: result.msgId,
                        preProcessedContent: formatMsg(result)
                    };
                });
                await imdbManager.storeProcessedChatMessages(results);
                await splitter.close();
            }
            LOGGER.success(`🥳任务完成: ${job.attrs.name}`);
        },
        {
            concurrency: 3,
            priority: "high"
        }
    );

    agendaInstance.define<TaskParameters<TaskHandlerTypes.DecideAndDispatchPreprocess>>(
        TaskHandlerTypes.DecideAndDispatchPreprocess,
        async job => {
            LOGGER.info(`😋开始处理任务: ${job.attrs.name}`);

            await agendaInstance.schedule("1 second", TaskHandlerTypes.Preprocess, {
                groupIds: Object.keys(config.groupConfigs),
                startTimeInMinutesFromNow: config.preprocessors.agendaTaskIntervalInMinutes * 10 // 乘以若干倍，以扩大时间窗口
            });

            LOGGER.success(`🥳任务完成: ${job.attrs.name}`);
        }
    );

    // 每隔一段时间触发一次DecideAndDispatchPreprocess任务
    LOGGER.debug(
        `DecideAndDispatchPreprocess任务将每隔${config.preprocessors.agendaTaskIntervalInMinutes}分钟执行一次`
    );
    await agendaInstance.every(
        config.preprocessors.agendaTaskIntervalInMinutes + " minutes",
        TaskHandlerTypes.DecideAndDispatchPreprocess
    );
    // 立即执行一次DecideAndDispatchPreprocess任务
    await agendaInstance.schedule("now", TaskHandlerTypes.DecideAndDispatchPreprocess);

    LOGGER.success("Ready to start agenda scheduler");
    await agendaInstance.start(); // 👈 启动调度器
})();
