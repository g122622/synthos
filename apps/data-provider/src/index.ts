import Logger from "@root/common/util/Logger";
import { QQProvider } from "./providers/QQProvider";
import { IMDBManager } from "@root/common/database/IMDBManager";
import { getHoursAgoTimestamp } from "@root/common/util/TimeUtils";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { TaskHandlerTypes, TaskParameters } from "@root/common/scheduler/@types/Tasks";
import { IMTypes } from "@root/common/types/data-provider";
import { IIMProvider } from "./providers/@types/IIMProvider";

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
        },
        {
            concurrency: 3,
            priority: "high"
        }
    );

    await agendaInstance.schedule("every 10 minutes", TaskHandlerTypes.ProvideData, {
        IMType: IMTypes.QQ,
        groupIds: ["123456789"],
        startTimeStamp: getHoursAgoTimestamp(1),
        endTimeStamp: Date.now()
    });

    LOGGER.success("Ready to start agenda scheduler");
    await agendaInstance.start(); // 👈 启动调度器
})();
