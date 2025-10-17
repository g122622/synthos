import Logger from "@root/common/util/Logger";
import { QQProvider } from "./providers/QQProvider";
import { IMDBManager } from "@root/common/database/IMDBManager";
import { getHoursAgoTimestamp } from "@root/common/util/TimeUtils";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { TaskHandlerTypes, TaskParameters } from "@root/common/scheduler/@types/Tasks";
import { IMTypes } from "@root/common/types/data-provider";
import { IIMProvider } from "./providers/@types/IIMProvider";
import ConfigManagerService from "@root/common/config/ConfigManagerService";
import { sleep } from "@root/common/util/promisify/sleep";

(async () => {
    const LOGGER = Logger.withTag("data-provider-root-script");
    LOGGER.debug("QQProvider start to init");

    const imdbManager = new IMDBManager();
    await imdbManager.init();
    // 释放imdbManager
    process.on("SIGINT", async () => {
        console.log("SIGINT received, closing...");
        await imdbManager.close();
        process.exit(0);
    });
    LOGGER.success("imdbManager init success");

    agendaInstance.define<TaskParameters<TaskHandlerTypes.ProvideData>>(
        TaskHandlerTypes.ProvideData,
        async job => {
            LOGGER.info(`开始处理任务: ${job.attrs.name}`);
            const attrs = job.attrs.data;

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
                console.dir(results);
                await imdbManager.storeRawChatMessages(results);
            }
            await activeProvider.close();
            LOGGER.success(`任务完成: ${job.attrs.name}`);
        },
        {
            concurrency: 3,
            priority: "high"
        }
    );

    agendaInstance.define<TaskParameters<TaskHandlerTypes.DecideAndDispatchProvideData>>(
        TaskHandlerTypes.DecideAndDispatchProvideData,
        async job => {
            LOGGER.info(`开始处理任务: ${job.attrs.name}`);
            const config = await ConfigManagerService.getCurrentConfig();
            // call provideData task
            await agendaInstance.schedule("1 second", TaskHandlerTypes.ProvideData, {
                IMType: IMTypes.QQ,
                groupIds: Object.keys(config.groupConfigs), // TODO 支持wechat之后，需要修改这里
                startTimeStamp: getHoursAgoTimestamp(1),
                endTimeStamp: Date.now()
            });

            LOGGER.success(`任务完成: ${job.attrs.name}`);
        }
    );

    // 每1小时触发一次DecideAndDispatchProvideData任务
    await agendaInstance.every("1 hour", TaskHandlerTypes.DecideAndDispatchProvideData);

    LOGGER.success("Ready to start agenda scheduler");
    await agendaInstance.start(); // 👈 启动调度器
})();
