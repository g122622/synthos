import "reflect-metadata";
import { IMDBManager } from "@root/common/database/IMDBManager";
import { AccumulativeSplitter } from "./splitters/AccumulativeSplitter";
import { TimeoutSplitter } from "./splitters/TimeoutSplitter";
import Logger from "@root/common/util/Logger";
import { ProcessedChatMessage } from "@root/common/contracts/data-provider";
import { formatMsg } from "./formatMsg";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { registerConfigManagerService, getConfigManagerService } from "@root/common/di/container";
import { TaskHandlerTypes, TaskParameters } from "@root/common/scheduler/@types/Tasks";
import { ISplitter } from "./splitters/contracts/ISplitter";

(async () => {
    // 初始化 DI 容器
    registerConfigManagerService();
    const configManagerService = getConfigManagerService();

    const LOGGER = Logger.withTag("🏭 preprocessor-root-script");

    const imdbManager = new IMDBManager();
    await imdbManager.init();

    let config = await configManagerService.getCurrentConfig();

    await agendaInstance
        .create(TaskHandlerTypes.Preprocess)
        .unique({ name: TaskHandlerTypes.Preprocess }, { insertOnly: true })
        .save();
    agendaInstance.define<TaskParameters<TaskHandlerTypes.Preprocess>>(
        TaskHandlerTypes.Preprocess,
        async job => {
            LOGGER.info(`😋开始处理任务: ${job.attrs.name}`);
            const attrs = job.attrs.data;
            config = await configManagerService.getCurrentConfig(); // 刷新配置

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
                const results = await Promise.all(
                    (
                        await splitter.assignSessionId(
                            imdbManager,
                            groupId,
                            attrs.startTimeInMinutesFromNow
                        )
                    ).map<Promise<ProcessedChatMessage>>(async result => {
                        return {
                            sessionId: result.sessionId!,
                            msgId: result.msgId,
                            preProcessedContent: formatMsg(
                                result,
                                result.quotedMsgId
                                    ? (await imdbManager.getRawChatMessageByMsgId(
                                          result.quotedMsgId
                                      ))
                                    : undefined
                            )
                        };
                    })
                );
                await imdbManager.storeProcessedChatMessages(results);
                await splitter.dispose();
            }

            await agendaInstance.now(TaskHandlerTypes.DecideAndDispatchAISummarize);
            LOGGER.success(`🥳任务完成: ${job.attrs.name}`);
        },
        {
            concurrency: 1,
            priority: "high"
        }
    );

    await agendaInstance
        .create(TaskHandlerTypes.DecideAndDispatchPreprocess)
        .unique({ name: TaskHandlerTypes.DecideAndDispatchPreprocess }, { insertOnly: true })
        .save();
    agendaInstance.define<TaskParameters<TaskHandlerTypes.DecideAndDispatchPreprocess>>(
        TaskHandlerTypes.DecideAndDispatchPreprocess,
        async job => {
            LOGGER.info(`😋开始处理任务: ${job.attrs.name}`);
            config = await configManagerService.getCurrentConfig(); // 刷新配置

            await agendaInstance.now(TaskHandlerTypes.Preprocess, {
                groupIds: Object.keys(config.groupConfigs),
                startTimeInMinutesFromNow: Math.max(
                    config.preprocessors.agendaTaskIntervalInMinutes * 10,
                    24 * 60
                ) // 乘以若干倍，以扩大时间窗口
            });

            LOGGER.success(`🥳任务完成: ${job.attrs.name}`);
        }
    );

    LOGGER.success("Ready to start agenda scheduler");
    await agendaInstance.start(); // 👈 启动调度器
})();
