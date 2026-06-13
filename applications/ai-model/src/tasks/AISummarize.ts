import "reflect-metadata";
import type { SessionDigestCoverage } from "@root/common/services/database/AgcDbAccessService";

import { injectable, inject } from "tsyringe";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { TaskHandlerTypes, TaskParameters } from "@root/common/scheduler/@types/Tasks";
import Logger from "@root/common/util/Logger";
import { checkConnectivity } from "@root/common/util/network/checkConnectivity";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { ProcessedChatMessageWithRawMessage } from "@root/common/contracts/data-provider";
import { AgcDbAccessService } from "@root/common/services/database/AgcDbAccessService";
import { AIDigestResult } from "@root/common/contracts/ai-model";
import getRandomHash from "@root/common/util/math/getRandomHash";
import { COMMON_TOKENS } from "@root/common/di/tokens";

import { IMSummaryCtxBuilder } from "../context/ctxBuilders/IMSummaryCtxBuilder";
import {
    PooledTextGeneratorService,
    PooledTask,
    PooledTaskResult
} from "../services/generators/text/PooledTextGeneratorService";

const MIN_SUMMARY_MESSAGE_COUNT = 10;

interface TaskContext {
    groupId: string;
    sessionId: string;
    latestMessageTimestamp: number;
    messageCount: number;
}

/**
 * AI 摘要任务处理器
 * 负责对群聊消息进行 AI 摘要生成
 */
@injectable()
export class AISummarizeTaskHandler {
    private LOGGER = Logger.withTag("🤖 AISummarizeTask");

    public constructor(
        @inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService,
        @inject(COMMON_TOKENS.ImDbAccessService) private imDbAccessService: ImDbAccessService,
        @inject(COMMON_TOKENS.AgcDbAccessService) private agcDbAccessService: AgcDbAccessService
    ) {}

    /**
     * 注册任务到 Agenda 调度器
     */
    public async register(): Promise<void> {
        let config = await this.configManagerService.getCurrentConfig();

        await agendaInstance
            .create(TaskHandlerTypes.AISummarize)
            .unique({ name: TaskHandlerTypes.AISummarize }, { insertOnly: true })
            .save();

        agendaInstance.define<TaskParameters<TaskHandlerTypes.AISummarize>>(
            TaskHandlerTypes.AISummarize,
            async job => {
                this.LOGGER.info(`😋开始处理任务: ${job.attrs.name}`);
                const attrs = job.attrs.data;

                config = await this.configManagerService.getCurrentConfig(); // 刷新配置

                if (!(await checkConnectivity())) {
                    this.LOGGER.error(`网络连接不可用，跳过当前任务`);

                    return;
                }

                const pooledTextGeneratorService = new PooledTextGeneratorService(config.ai.maxConcurrentRequests);

                await pooledTextGeneratorService.init();
                const ctxBuilder = new IMSummaryCtxBuilder();

                await ctxBuilder.init();

                // 收集所有需要处理的任务
                const allTasks: PooledTask<TaskContext>[] = [];
                const activeSessionGraceMs = config.preprocessors.TimeoutSplitter.timeoutInMinutes * 60 * 1000;

                for (const groupId of attrs.groupIds) {
                    /* 1. 获取指定时间范围内的消息 */
                    const msgs = (
                        await this.imDbAccessService.getProcessedChatMessageWithRawMessageByGroupIdAndTimeRange(
                            groupId,
                            attrs.startTimeStamp,
                            attrs.endTimeStamp
                        )
                    ).filter(msg => {
                        // 过滤掉sessionId为空的消息
                        if (!msg.sessionId) {
                            this.LOGGER.warning(`消息 ${msg.msgId} 的 sessionId 为空，跳过`);

                            return false;
                        } else {
                            return true;
                        }
                    });

                    this.LOGGER.info(`群 ${groupId} 成功获取到 ${msgs.length} 条有效消息`);
                    await job.touch(); // 保证任务存活

                    /* 2. 按照 sessionId 分组 */
                    const sessions: Record<string, ProcessedChatMessageWithRawMessage[]> = {};

                    for (const msg of msgs) {
                        const { sessionId } = msg;

                        if (!sessions[sessionId]) {
                            sessions[sessionId] = [];
                        }
                        sessions[sessionId].push(msg);
                    }
                    if (Object.keys(sessions).length === 0) {
                        this.LOGGER.info(`群 ${groupId} 在指定时间范围内无消息，跳过`);
                        continue;
                    }

                    // 最新 session 在静默时间不足时先跳过，避免把仍在发生的对话截断。
                    // 网络恢复补跑需要尽快追上断网期间遗漏的消息，因此允许调用方显式跳过这层保护。
                    const newestSessionId = msgs[msgs.length - 1].sessionId;
                    const newestSessionMessages = sessions[newestSessionId];

                    if (newestSessionMessages) {
                        const newestSessionLatestTimestamp =
                            newestSessionMessages[newestSessionMessages.length - 1].timestamp;
                        const idleTime = attrs.endTimeStamp - newestSessionLatestTimestamp;

                        if (attrs.ignoreActiveSessionGrace) {
                            this.LOGGER.info(
                                `已启用网络恢复补跑模式，最新 session ${newestSessionId} 即使静默时间不足也纳入摘要`
                            );
                        } else if (idleTime < activeSessionGraceMs) {
                            delete sessions[newestSessionId];
                            this.LOGGER.debug(
                                `最新 session ${newestSessionId} 静默时间不足 ${Math.ceil(activeSessionGraceMs / 60000)} 分钟，暂不摘要`
                            );
                        } else {
                            this.LOGGER.debug(`最新 session ${newestSessionId} 已静默足够久，纳入摘要`);
                        }
                    }
                    this.LOGGER.info(`分组完成，共 ${Object.keys(sessions).length} 个候选 session`);

                    const sessionMessagesToSummarize: Record<string, ProcessedChatMessageWithRawMessage[]> = {};
                    const sessionDigestMetadata: Record<
                        string,
                        {
                            latestMessageTimestamp: number;
                            messageCount: number;
                        }
                    > = {};

                    // 3. 过滤掉摘要已经覆盖的 session，并只保留新增消息片段
                    for (const sessionId in sessions) {
                        const fullSessionMessages =
                            await this.imDbAccessService.getProcessedChatMessagesBySessionId(sessionId);

                        if (fullSessionMessages.length === 0) {
                            this.LOGGER.warning(`session ${sessionId} 未找到完整消息，跳过`);
                            continue;
                        }

                        const latestMessageTimestamp =
                            fullSessionMessages[fullSessionMessages.length - 1].timestamp;
                        const messageCount = fullSessionMessages.length;

                        if (
                            await this.agcDbAccessService.isSessionDigestFresh(
                                sessionId,
                                latestMessageTimestamp,
                                messageCount
                            )
                        ) {
                            this.LOGGER.info(`session ${sessionId} 已经摘要到最新消息，跳过`);
                            continue;
                        }

                        const coverage = await this.agcDbAccessService.getSessionDigestCoverage(sessionId);
                        const messagesToSummarize = this._getMessagesToSummarizeByCoverage(
                            fullSessionMessages,
                            coverage
                        );

                        if (messagesToSummarize.length <= MIN_SUMMARY_MESSAGE_COUNT) {
                            this.LOGGER.warning(
                                `session ${sessionId} 新增可摘要消息数量不足，消息数量为 ${messagesToSummarize.length}，跳过`
                            );
                            continue;
                        }

                        sessionMessagesToSummarize[sessionId] = messagesToSummarize;
                        sessionDigestMetadata[sessionId] = {
                            latestMessageTimestamp,
                            messageCount
                        };
                    }

                    /* 4. 构建任务列表 */
                    for (const sessionId in sessionMessagesToSummarize) {
                        this.LOGGER.info(
                            `准备处理 session ${sessionId}，本次新增可摘要消息共 ${sessionMessagesToSummarize[sessionId].length} 条`
                        );

                        // 构建上下文
                        const ctx = await ctxBuilder.buildCtx(
                            sessionMessagesToSummarize[sessionId],
                            config.groupConfigs[groupId].groupIntroduction
                        );

                        this.LOGGER.info(`session ${sessionId} 构建上下文成功，长度为 ${ctx.length}`);

                        allTasks.push({
                            input: ctx,
                            modelNames: config.groupConfigs[groupId].aiModels,
                            context: {
                                groupId,
                                sessionId,
                                latestMessageTimestamp: sessionDigestMetadata[sessionId].latestMessageTimestamp,
                                messageCount: sessionDigestMetadata[sessionId].messageCount
                            },
                            checkJsonFormat: true
                        });
                    }
                }

                this.LOGGER.info(
                    `共收集到 ${allTasks.length} 个任务，开始并行处理（并行度=${config.ai.maxConcurrentRequests}）`
                );

                if (allTasks.length === 0) {
                    this.LOGGER.info("没有需要生成摘要的 session，任务完成");
                    pooledTextGeneratorService.dispose();
                    ctxBuilder.dispose();
                    this.LOGGER.success(`🥳任务完成: ${job.attrs.name}`);

                    return;
                }

                // 并行处理所有任务，每个任务完成时回调
                let completedCount = 0;

                await pooledTextGeneratorService.submitTasks<TaskContext>(
                    allTasks,
                    async (result: PooledTaskResult<TaskContext>) => {
                        await job.touch(); // 保证任务存活
                        completedCount++;
                        const { sessionId, latestMessageTimestamp, messageCount } = result.context;

                        if (!result.isSuccess) {
                            this.LOGGER.error(
                                `[${completedCount}/${allTasks.length}] session ${sessionId} 生成摘要失败，错误信息为：${result.error}, 跳过该session`
                            );

                            return;
                        }

                        try {
                            const resultStr = result.content!;
                            const selectedModelName = result.selectedModelName!;

                            // 解析llm回传的json结果
                            let results: Omit<Omit<AIDigestResult, "sessionId">, "topicId">[] = [];

                            results = JSON.parse(resultStr);
                            this.LOGGER.success(
                                `[${completedCount}/${allTasks.length}] session ${sessionId} 生成摘要成功，长度为 ${resultStr.length}`
                            );
                            if (resultStr.length < 30) {
                                this.LOGGER.warning(
                                    `session ${sessionId} 生成摘要长度过短，长度为 ${resultStr.length}，跳过`
                                );

                                return;
                            }

                            if (results.length === 0) {
                                this.LOGGER.warning(`session ${sessionId} 生成摘要为空，跳过`);

                                return;
                            }

                            // 遍历ai生成的结果数组，添加sessionId、topicId，并解析contributors
                            for (const resultItem of results) {
                                Object.assign(resultItem, { sessionId }); // 添加 sessionId
                                resultItem.contributors = JSON.stringify(resultItem.contributors); // 转换为字符串
                                Object.assign(resultItem, { topicId: getRandomHash(16) });
                                Object.assign(resultItem, { modelName: selectedModelName });
                                Object.assign(resultItem, { updateTime: Date.now() });
                            }

                            // 存储摘要结果，并记录本次摘要覆盖到的消息范围
                            await this.agcDbAccessService.storeAIDigestResultsWithSessionMetadata(
                                sessionId,
                                results as AIDigestResult[],
                                {
                                    summarizedUntil: latestMessageTimestamp,
                                    summarizedMessageCount: messageCount
                                }
                            );
                            this.LOGGER.success(`session ${sessionId} 存储摘要成功！`);
                        } catch (error) {
                            this.LOGGER.error(
                                `session ${sessionId} 处理结果失败，错误信息为：${error}, 跳过该session`
                            );
                        }
                    }
                );

                pooledTextGeneratorService.dispose();
                ctxBuilder.dispose();

                this.LOGGER.success(`🥳任务完成: ${job.attrs.name}`);
            },
            {
                concurrency: 1,
                priority: "high",
                lockLifetime: 20 * 60 * 1000 // 20分钟
            }
        );
    }

    /**
     * 根据摘要覆盖范围切出本次需要摘要的消息
     * @param messages 完整 session 消息
     * @param coverage 摘要覆盖范围
     * @returns 本次需要摘要的消息
     */
    private _getMessagesToSummarizeByCoverage(
        messages: ProcessedChatMessageWithRawMessage[],
        coverage: SessionDigestCoverage | null
    ): ProcessedChatMessageWithRawMessage[] {
        if (!coverage) {
            return messages;
        }

        const messagesAfterTimestamp = messages.filter(msg => msg.timestamp > coverage.summarizedUntil);

        if (messagesAfterTimestamp.length > 0) {
            return messagesAfterTimestamp;
        }

        if (coverage.summarizedMessageCount !== null && coverage.summarizedMessageCount < messages.length) {
            return messages.slice(coverage.summarizedMessageCount);
        }

        return [];
    }
}
