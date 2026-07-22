import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import Logger from "@root/common/util/Logger";
import { checkConnectivity } from "@root/common/util/network/checkConnectivity";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { ProcessedChatMessageWithRawMessage } from "@root/common/contracts/data-provider";
import { AgcDbAccessService } from "@root/common/services/database/AgcDbAccessService";
import { AIDigestResult } from "@root/common/contracts/ai-model";
import getRandomHash from "@root/common/util/math/getRandomHash";
import { resolveContributorIds } from "@root/common/util/topic/resolveContributorIds";
import { AISummarizeInput, AISummarizeOutput } from "@root/common/rpc/ai-model/index";
import { COMMON_TOKENS } from "@root/common/di/tokens";

import { IMSummaryCtxBuilder } from "../context/ctxBuilders/IMSummaryCtxBuilder";
import {
    PooledTextGeneratorService,
    PooledTask,
    PooledTaskResult
} from "../services/generators/text/PooledTextGeneratorService";

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
     * 执行 AI 摘要任务
     * 对指定群组、时间范围内的预处理消息按 session 分组生成 AI 摘要并落库
     * @param params 任务参数
     * @returns 执行结果
     */
    public async run(params: AISummarizeInput): Promise<AISummarizeOutput> {
        this.LOGGER.info(`😋开始处理 AISummarize 任务`);
        const { groupIds, startTimeStamp, endTimeStamp } = params;

        const config = await this.configManagerService.getCurrentConfig();

        if (!(await checkConnectivity())) {
            this.LOGGER.error(`网络连接不可用，跳过当前任务`);

            return { success: true };
        }

        const pooledTextGeneratorService = new PooledTextGeneratorService(config.ai.maxConcurrentRequests);

        await pooledTextGeneratorService.init();
        const ctxBuilder = new IMSummaryCtxBuilder();

        await ctxBuilder.init();

        // 任务上下文类型定义
        interface TaskContext {
            groupId: string;
            sessionId: string;
            // 该 session 的全部消息，用于回调内即时反查 contributorIDs（昵称→QQ号）
            messages: ProcessedChatMessageWithRawMessage[];
        }

        // 收集所有需要处理的任务
        const allTasks: PooledTask<TaskContext>[] = [];

        for (const groupId of groupIds) {
            /* 1. 获取指定时间范围内的消息 */
            const msgs = (
                await this.imDbAccessService.getProcessedChatMessageWithRawMessageByGroupIdAndTimeRange(
                    groupId,
                    startTimeStamp,
                    endTimeStamp
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

            /* 2. 按照 sessionId 分组 */
            const sessions: Record<string, ProcessedChatMessageWithRawMessage[]> = {};

            for (const msg of msgs) {
                const { sessionId } = msg;

                // 如果 sessionId 已经被生成过摘要，跳过
                if (!(await this.agcDbAccessService.isSessionIdSummarized(sessionId))) {
                    if (!sessions[sessionId]) {
                        sessions[sessionId] = [];
                    }
                    sessions[sessionId].push(msg);
                }
            }
            if (Object.keys(sessions).length === 0) {
                this.LOGGER.info(`群 ${groupId} 在指定时间范围内无消息，跳过`);
                continue;
            }
            // 考虑到最后一个session可能正在发生，还没有闭合，因此需要删掉
            const newestSessionId = msgs[msgs.length - 1].sessionId;

            delete sessions[newestSessionId];
            this.LOGGER.debug(`删掉了最后一个sessionId为 ${newestSessionId} 的session`);
            this.LOGGER.info(`分组完成，共 ${Object.keys(sessions).length} 个需要处理的session`);

            // 3. 删掉消息量不够的session
            for (const sessionId in sessions) {
                if (sessions[sessionId].length <= 10) {
                    this.LOGGER.warning(
                        `session ${sessionId} 消息数量不足，消息数量为${sessions[sessionId].length}，跳过`
                    );
                    delete sessions[sessionId];
                }
            }

            /* 4. 构建任务列表 */
            for (const sessionId in sessions) {
                this.LOGGER.info(
                    `准备处理session ${sessionId} ，该session内共 ${sessions[sessionId].length} 条消息`
                );

                // 构建上下文
                const ctx = await ctxBuilder.buildCtx(
                    sessions[sessionId],
                    config.groupConfigs[groupId].groupIntroduction
                );

                this.LOGGER.info(`session ${sessionId} 构建上下文成功，长度为 ${ctx.length}`);

                allTasks.push({
                    input: ctx,
                    modelNames: config.groupConfigs[groupId].aiModels,
                    context: { groupId, sessionId, messages: sessions[sessionId] },
                    checkJsonFormat: true
                });
            }
        }

        this.LOGGER.info(`共收集到 ${allTasks.length} 个任务，开始并行处理（并行度=5）`);

        // 并行处理所有任务，每个任务完成时回调
        let completedCount = 0;

        await pooledTextGeneratorService.submitTasks<TaskContext>(
            allTasks.reverse(), // 反转任务列表，优先处理后加入的任务（通常是更近的消息）
            async (result: PooledTaskResult<TaskContext>) => {
                completedCount++;
                const { sessionId } = result.context;

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
                        console.log(resultStr);

                        return;
                    }

                    // 遍历ai生成的结果数组，添加sessionId、topicId，并解析contributors
                    for (const resultItem of results) {
                        Object.assign(resultItem, { sessionId }); // 添加 sessionId
                        // 抓取参与者昵称数组（此时仍为数组），用于即时反查 QQ 号
                        const rawContributors = resultItem.contributors as unknown;
                        const contributorNames: string[] = Array.isArray(rawContributors)
                            ? rawContributors.filter((n: unknown) => typeof n === "string")
                            : [];

                        resultItem.contributors = JSON.stringify(resultItem.contributors); // 转换为字符串
                        // 即时反查 contributorIDs：与 contributors 昵称数组等长、顺序一一对应的 QQ 号数组
                        const contributorIdsArray = resolveContributorIds(
                            result.context.messages,
                            contributorNames
                        );

                        Object.assign(resultItem, { contributorIDs: JSON.stringify(contributorIdsArray) });
                        Object.assign(resultItem, { topicId: getRandomHash(16) });
                        Object.assign(resultItem, { modelName: selectedModelName });
                        Object.assign(resultItem, { updateTime: Date.now() });
                        Object.assign(resultItem, { hasEmbedding: false }); // 新生成的摘要尚未生成嵌入向量
                    }

                    // 存储摘要结果
                    await this.agcDbAccessService.storeAIDigestResults(results as AIDigestResult[]);
                    this.LOGGER.success(`session ${sessionId} 存储摘要成功！`);
                } catch (error) {
                    this.LOGGER.error(`session ${sessionId} 处理结果失败，错误信息为：${error}, 跳过该session`);
                }
            }
        );

        pooledTextGeneratorService.dispose();
        ctxBuilder.dispose();

        this.LOGGER.success(`🥳AISummarize 任务完成`);

        return { success: true };
    }
}
