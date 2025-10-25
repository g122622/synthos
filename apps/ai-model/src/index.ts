import { TextGenerator } from "./generators/text/TextGenerator";
import { IMSummaryCtxBuilder } from "./context/ctxBuilders/IMSummaryCtxBuilder";
import { AIDigestResult } from "@root/common/types/ai-model";
import { AGCDBManager } from "@root/common/database/AGCDBManager";
import { IMDBManager } from "@root/common/database/IMDBManager";
import { InterestScoreDBManager } from "@root/common/database/InterestScoreDBManager";
import { getHoursAgoTimestamp, getMinutesAgoTimestamp } from "@root/common/util/TimeUtils";
import getRandomHash from "@root/common/util/getRandomHash";
import Logger from "@root/common/util/Logger";
import { ProcessedChatMessageWithRawMessage } from "@root/common/types/data-provider";
import ConfigManagerService from "@root/common/config/ConfigManagerService";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { TaskHandlerTypes, TaskParameters } from "@root/common/scheduler/@types/Tasks";
import { checkConnectivity } from "@root/common/util/network/checkConnectivity";
import { SemanticRater } from "./misc/SemanticRater";

(async () => {
    const LOGGER = Logger.withTag("ai-model-root-script");

    const imdbManager = new IMDBManager();
    await imdbManager.init();
    const agcDBManager = new AGCDBManager();
    await agcDBManager.init();
    const interestScoreDBManager = new InterestScoreDBManager();
    await interestScoreDBManager.init();

    let config = await ConfigManagerService.getCurrentConfig();

    agendaInstance.define<TaskParameters<TaskHandlerTypes.AISummarize>>(
        TaskHandlerTypes.AISummarize,
        async job => {
            LOGGER.info(`😋开始处理任务: ${job.attrs.name}`);
            const attrs = job.attrs.data;
            config = await ConfigManagerService.getCurrentConfig(); // 刷新配置

            if (!(await checkConnectivity())) {
                LOGGER.error(`网络连接不可用，跳过当前任务`);
                return;
            }

            const textGenerator = new TextGenerator();
            await textGenerator.init();
            const ctxBuilder = new IMSummaryCtxBuilder();
            await ctxBuilder.init();

            for (const groupId of attrs.groupIds) {
                /* 获取指定时间范围内的消息 */
                const msgs = (
                    await imdbManager.getProcessedChatMessageWithRawMessageByGroupIdAndTimeRange(
                        groupId,
                        attrs.startTimeStamp,
                        attrs.endTimeStamp
                    )
                ).filter(msg => {
                    // 过滤掉sessionId为空的消息
                    if (!msg.sessionId) {
                        LOGGER.warning(`消息 ${msg.msgId} 的 sessionId 为空，跳过`);
                        return false;
                    } else {
                        return true;
                    }
                });
                LOGGER.debug(`群 ${groupId} 成功获取到 ${msgs.length} 条有效消息`);

                /* 按照 sessionId 分组 */
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
                if (Object.keys(sessions).length === 0) {
                    LOGGER.info(`群 ${groupId} 在指定时间范围内无消息，跳过`);
                    continue;
                }
                // 考虑到最后一个session可能正在发生，还没有闭合，因此需要删掉
                const newestSessionId = msgs[msgs.length - 1].sessionId;
                delete sessions[newestSessionId];
                LOGGER.debug(`删掉了最后一个sessionId为 ${newestSessionId} 的session`);
                LOGGER.info(`分组完成，共 ${Object.keys(sessions).length} 个需要处理的sessionId组`);

                /* 遍历每个session */
                for (const sessionId in sessions) {
                    await job.touch(); // 保证任务存活

                    LOGGER.info(
                        `开始处理session ${sessionId}，共 ${sessions[sessionId].length} 条消息`
                    );
                    if (sessions[sessionId].length <= 1) {
                        LOGGER.warning(
                            `session ${sessionId} 消息数量不足，消息数量为${sessions[sessionId].length}，跳过`
                        );
                        continue;
                    }

                    const ctx = await ctxBuilder.buildCtx(
                        sessions[sessionId],
                        config.groupConfigs[groupId].groupIntroduction
                    );
                    LOGGER.info(`session ${sessionId} 构建上下文成功，长度为 ${ctx.length}`);
                    const resultStr = await textGenerator.generateText(
                        config.groupConfigs[groupId].aiModel!,
                        ctx
                    );
                    let results: Omit<Omit<AIDigestResult, "sessionId">, "topicId">[] = [];
                    try {
                        results = JSON.parse(resultStr);
                        LOGGER.success(
                            `session ${sessionId} 生成摘要成功，长度为 ${resultStr.length}`
                        );
                        if (resultStr.length < 30) {
                            LOGGER.warning(
                                `session ${sessionId} 生成摘要长度过短，长度为 ${resultStr.length}，跳过`
                            );
                            console.log(resultStr);
                            continue;
                        }
                    } catch (error) {
                        LOGGER.error(
                            `session ${sessionId} 解析llm回传的json结果失败：${error}，跳过当前会话`
                        );
                        LOGGER.error(`原始响应为：`);
                        console.log(resultStr);
                        continue; // 跳过当前会话
                    }
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
            agendaInstance.schedule("1 second", TaskHandlerTypes.DecideAndDispatchInterestScore);
        },
        {
            concurrency: 1,
            priority: "high",
            lockLifetime: 10 * 60 * 1000 // 10分钟
        }
    );

    agendaInstance.define<TaskParameters<TaskHandlerTypes.DecideAndDispatchAISummarize>>(
        TaskHandlerTypes.DecideAndDispatchAISummarize,
        async job => {
            LOGGER.info(`😋开始处理任务: ${job.attrs.name}`);

            await agendaInstance.schedule("1 second", TaskHandlerTypes.AISummarize, {
                groupIds: Object.keys(config.groupConfigs),
                startTimeStamp: getHoursAgoTimestamp(24), // 24小时前
                endTimeStamp: Date.now() // 现在
            });

            LOGGER.success(`🥳任务完成: ${job.attrs.name}`);
        },
        {
            concurrency: 1,
            priority: "high",
            lockLifetime: 10 * 60 * 1000 // 10分钟
        }
    );

    agendaInstance.define<TaskParameters<TaskHandlerTypes.InterestScore>>(
        TaskHandlerTypes.InterestScore,
        async job => {
            LOGGER.info(`😋开始处理任务: ${job.attrs.name}`);
            const attrs = job.attrs.data;
            config = await ConfigManagerService.getCurrentConfig(); // 刷新配置

            const sessionIds = [] as string[];
            for (const groupId of Object.keys(config.groupConfigs)) {
                sessionIds.push(
                    ...(await imdbManager.getSessionIdsByGroupIdAndTimeRange(
                        groupId,
                        attrs.startTimeStamp,
                        attrs.endTimeStamp
                    ))
                );
            }

            const digestResults = [] as AIDigestResult[];
            for (const sessionId of sessionIds) {
                digestResults.push(
                    ...(await agcDBManager.getAIDigestResultsBySessionId(sessionId))
                );
            }
            LOGGER.info(`共获取到 ${digestResults.length} 条待打分的摘要结果`);

            const rater = new SemanticRater();
            for (const digestResult of digestResults) {
                await job.touch(); // 保证任务存活
                if (await interestScoreDBManager.isInterestScoreResultExist(digestResult.topicId)) {
                    LOGGER.debug(`话题 ${digestResult.topicId} 已经计算过兴趣度，跳过`);
                    continue;
                }
                // 转换参数格式
                const argArr = [];
                argArr.push(
                    ...config.ai.interestScore.UserInterestsPositiveKeywords.map(keyword => {
                        return {
                            keyword,
                            liked: true
                        };
                    })
                );
                argArr.push(
                    ...config.ai.interestScore.UserInterestsNegativeKeywords.map(keyword => {
                        return {
                            keyword,
                            liked: false
                        };
                    })
                );
                const score = await rater.scoreTopic(
                    argArr,
                    `话题：${digestResult.topic} 正文内容：${digestResult.detail}`
                );
                await interestScoreDBManager.storeInterestScoreResult(digestResult.topicId, score);
            }

            LOGGER.success(`🥳任务完成: ${job.attrs.name}`);
        },
        {
            concurrency: 1,
            priority: "high",
            lockLifetime: 10 * 60 * 1000 // 10分钟
        }
    );

    agendaInstance.define<TaskParameters<TaskHandlerTypes.DecideAndDispatchInterestScore>>(
        TaskHandlerTypes.DecideAndDispatchInterestScore,
        async job => {
            LOGGER.info(`😋开始处理任务: ${job.attrs.name}`);

            await agendaInstance.schedule("1 second", TaskHandlerTypes.InterestScore, {
                startTimeStamp: getHoursAgoTimestamp(24 * 3),
                endTimeStamp: Date.now() // 现在
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

    // 立即执行一次DecideAndDispatch任务
    LOGGER.info(`立即执行一次DecideAndDispatch任务`);
    await agendaInstance.schedule("1 second", TaskHandlerTypes.DecideAndDispatchAISummarize);

    LOGGER.success("Ready to start agenda scheduler");
    await agendaInstance.start(); // 👈 启动调度器
})();
