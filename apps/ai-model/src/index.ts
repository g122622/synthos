import { TextGenerator } from "./generators/text/TextGenerator";
import { IMCtxBuilder } from "./context/ctxBuilders/IMCtxBuilder";
import { AIDigestResult } from "@root/common/types/ai-model";
import { AGCDBManager } from "@root/common/database/AGCDBManager";
import { IMDBManager } from "@root/common/database/IMDBManager";
import { getHoursAgoTimestamp } from "@root/common/util/TimeUtils";
import getRandomHash from "@root/common/util/getRandomHash";
import Logger from "@root/common/util/Logger";
import { ProcessedChatMessageWithRawMessage } from "@root/common/types/data-provider";
import ConfigManagerService from "@root/common/config/ConfigManagerService";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { TaskHandlerTypes, TaskParameters } from "@root/common/scheduler/@types/Tasks";

(async () => {
    const LOGGER = Logger.withTag("ai-model-root-script");

    const imdbManager = new IMDBManager();
    await imdbManager.init();
    const agcDBManager = new AGCDBManager();
    await agcDBManager.init();

    let config = await ConfigManagerService.getCurrentConfig();

    agendaInstance.define<TaskParameters<TaskHandlerTypes.AISummarize>>(
        TaskHandlerTypes.AISummarize,
        async job => {
            LOGGER.info(`😋开始处理任务: ${job.attrs.name}`);
            const attrs = job.attrs.data;
            config = await ConfigManagerService.getCurrentConfig(); // 刷新配置

            const textGenerator = new TextGenerator();
            await textGenerator.init();
            const ctxBuilder = new IMCtxBuilder();
            await ctxBuilder.init();

            for (const groupId of attrs.groupIds) {
                const msgs =
                    await imdbManager.getProcessedChatMessageWithRawMessageByGroupIdAndTimeRange(
                        groupId,
                        attrs.startTimeStamp,
                        attrs.endTimeStamp
                    );
                // 按照 sessionId 分组
                const sessions: Record<string, ProcessedChatMessageWithRawMessage[]> = {};
                for (const msg of msgs) {
                    const { sessionId } = msg;
                    // 如果 sessionId 已经被汇总过，跳过
                    if (!(await agcDBManager.isSessionIdSummarized(sessionId))) {
                        if (!sessions[sessionId]) {
                            sessions[sessionId] = [];
                        }
                        sessions[sessionId].push(msg);
                    }
                }
                LOGGER.info(`分组完成，共 ${Object.keys(sessions).length} 个需要处理的sessionId组`);
                // 遍历每个session
                for (const sessionId in sessions) {
                    const messages = sessions[sessionId];
                    const ctx = await ctxBuilder.buildCtx(messages);
                    LOGGER.info(`session ${sessionId} 构建上下文成功，长度为 ${ctx.length}`);
                    const resultStr = await textGenerator.generateText(
                        config.groupConfigs[groupId].aiModel!,
                        ctx
                    );
                    let results: Omit<Omit<AIDigestResult, "sessionId">, "topicId">[] = [];
                    try {
                        results = JSON.parse(resultStr);
                    } catch (error) {
                        LOGGER.error(`session ${sessionId} 解析摘要失败：${error}，跳过当前会话`);
                        continue; // 跳过当前会话
                    }
                    LOGGER.success(`session ${sessionId} 生成摘要成功！`);
                    // 遍历这个session下的每个话题，增加必要的字段
                    for (const result of results) {
                        Object.assign(result, { sessionId }); // 添加 sessionId
                        result.contributors = JSON.stringify(result.contributors); // 转换为字符串
                        Object.assign(result, { topicId: getRandomHash(16) });
                    }
                    await agcDBManager.storeAIDigestResults(results as AIDigestResult[]);
                    LOGGER.success(`session ${sessionId} 存储摘要成功！`);
                }
            }

            LOGGER.success(`🥳任务完成: ${job.attrs.name}`);
        },
        {
            concurrency: 3,
            priority: "high"
        }
    );

    agendaInstance.define<TaskParameters<TaskHandlerTypes.DecideAndDispatchAISummarize>>(
        TaskHandlerTypes.DecideAndDispatchAISummarize,
        async job => {
            LOGGER.info(`😋开始处理任务: ${job.attrs.name}`);

            // TODO

            await agendaInstance.schedule("1 second", TaskHandlerTypes.AISummarize, {
                groupIds: Object.keys(config.groupConfigs),
                startTimeInMinutesFromNow: config.ai.summarize.agendaTaskIntervalInMinutes * 10 // 乘以若干倍，以扩大时间窗口
            });

            LOGGER.success(`🥳任务完成: ${job.attrs.name}`);
        }
    );

    // 每隔一段时间触发一次DecideAndDispatch任务
    LOGGER.debug(
        `DecideAndDispatch任务将每隔${config.ai.summarize.agendaTaskIntervalInMinutes}分钟执行一次`
    );
    await agendaInstance.every(
        config.ai.summarize.agendaTaskIntervalInMinutes + " minutes",
        TaskHandlerTypes.DecideAndDispatchAISummarize
    );

    LOGGER.success("Ready to start agenda scheduler");
    await agendaInstance.start(); // 👈 启动调度器
})();
