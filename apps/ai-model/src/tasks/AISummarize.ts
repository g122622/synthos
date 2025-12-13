import { agendaInstance } from "@root/common/scheduler/agenda";
import { TaskHandlerTypes, TaskParameters } from "@root/common/scheduler/@types/Tasks";
import Logger from "@root/common/util/Logger";
import { getConfigManagerService } from "@root/common/di/container";
import { checkConnectivity } from "@root/common/util/network/checkConnectivity";
import { TextGenerator } from "@/generators/text/TextGenerator";
import { IMSummaryCtxBuilder } from "@/context/ctxBuilders/IMSummaryCtxBuilder";
import { IMDBManager } from "@root/common/database/IMDBManager";
import { ProcessedChatMessageWithRawMessage } from "@root/common/contracts/data-provider";
import { AGCDBManager } from "@root/common/database/AGCDBManager";
import { AIDigestResult } from "@root/common/contracts/ai-model";
import getRandomHash from "@root/common/util/getRandomHash";
import { getHoursAgoTimestamp } from "@root/common/util/TimeUtils";
import { duplicateElements } from "@root/common/util/core/duplicateElements";
import { sleep } from "@root/common/util/promisify/sleep";

export async function setupAISummarizeTask(imdbManager: IMDBManager, agcDBManager: AGCDBManager) {
    const LOGGER = Logger.withTag("🤖 [ai-model-root-script] [AISummarizeTask]");
    const configManagerService = getConfigManagerService();
    let config = await configManagerService.getCurrentConfig(); // 初始化配置

    await agendaInstance
        .create(TaskHandlerTypes.AISummarize)
        .unique({ name: TaskHandlerTypes.AISummarize }, { insertOnly: true })
        .save();
    agendaInstance.define<TaskParameters<TaskHandlerTypes.AISummarize>>(
        TaskHandlerTypes.AISummarize,
        async job => {
            LOGGER.info(`😋开始处理任务: ${job.attrs.name}`);
            const attrs = job.attrs.data;
            config = await configManagerService.getCurrentConfig(); // 刷新配置

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
                LOGGER.info(`群 ${groupId} 成功获取到 ${msgs.length} 条有效消息`);
                await job.touch(); // 保证任务存活

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
                LOGGER.info(`分组完成，共 ${Object.keys(sessions).length} 个需要处理的session`);

                /* 遍历每个session */
                for (const sessionId in sessions) {
                    await job.touch(); // 保证任务存活
                    try {
                        LOGGER.info(
                            `开始处理session ${sessionId}，该session内共由 ${sessions[sessionId].length} 条消息`
                        );
                        if (sessions[sessionId].length <= 3) {
                            LOGGER.warning(
                                `session ${sessionId} 消息数量不足，消息数量为${sessions[sessionId].length}，跳过`
                            );
                            continue;
                        }

                        // 1. 构建上下文
                        const ctx = await ctxBuilder.buildCtx(
                            sessions[sessionId],
                            config.groupConfigs[groupId].groupIntroduction
                        );
                        LOGGER.info(`session ${sessionId} 构建上下文成功，长度为 ${ctx.length}`);

                        // 2. 调用大模型生成摘要
                        // 从第一个开始尝试，如果失败了就会尝试下一个
                        const modelCandidates = [
                            ...duplicateElements(config.ai.pinnedModels, 2), // 失败重复机制：每个模型重复2次
                            ...config.groupConfigs[groupId].aiModels
                        ];
                        let resultStr = "";
                        for (const modelName of modelCandidates) {
                            try {
                                resultStr = await textGenerator.generateText(modelName, ctx);
                                if (resultStr) {
                                    break; // 如果成功，跳出循环
                                } else {
                                    throw new Error(`生成的摘要为空`);
                                }
                            } catch (error) {
                                LOGGER.error(
                                    `模型 ${modelName} 生成摘要失败，错误信息为：${error}, 尝试下一个模型`
                                );
                                await sleep(10000); // 等待10秒
                                continue; // 跳过当前模型，尝试下一个
                            }
                        }
                        if (!resultStr) {
                            throw new Error(`session ${sessionId} 所有模型都生成摘要失败，跳过`);
                        }

                        // 3. 解析llm回传的json结果
                        let results: Omit<Omit<AIDigestResult, "sessionId">, "topicId">[] = [];
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

                        // 4. 遍历ai生成的结果数组，添加sessionId、topicId，并解析contributors
                        for (const result of results) {
                            Object.assign(result, { sessionId }); // 添加 sessionId
                            result.contributors = JSON.stringify(result.contributors); // 转换为字符串
                            Object.assign(result, { topicId: getRandomHash(16) });
                        }

                        // 5. 存储摘要结果
                        await agcDBManager.storeAIDigestResults(results as AIDigestResult[]);
                        LOGGER.success(`session ${sessionId} 存储摘要成功！`);
                    } catch (error) {
                        LOGGER.error(
                            `session ${sessionId} 生成摘要失败，错误信息为：${error}, 跳过该session`
                        );
                        continue; // 跳过当前会话
                    }
                }
            }

            LOGGER.success(`🥳任务完成: ${job.attrs.name}`);
            agendaInstance.now(TaskHandlerTypes.DecideAndDispatchInterestScore);
        },
        {
            concurrency: 1,
            priority: "high",
            lockLifetime: 20 * 60 * 1000 // 20分钟
        }
    );

    await agendaInstance
        .create(TaskHandlerTypes.DecideAndDispatchAISummarize)
        .unique({ name: TaskHandlerTypes.DecideAndDispatchAISummarize }, { insertOnly: true })
        .save();
    agendaInstance.define<TaskParameters<TaskHandlerTypes.DecideAndDispatchAISummarize>>(
        TaskHandlerTypes.DecideAndDispatchAISummarize,
        async job => {
            LOGGER.info(`😋开始处理任务: ${job.attrs.name}`);
            config = await configManagerService.getCurrentConfig(); // 刷新配置

            await agendaInstance.now(TaskHandlerTypes.AISummarize, {
                groupIds: Object.keys(config.groupConfigs),
                startTimeStamp: getHoursAgoTimestamp(24 * 30), // 30天前
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
}
