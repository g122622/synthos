import "reflect-metadata";
import { TextGenerator } from "./generators/text/TextGenerator";
import { IMSummaryCtxBuilder } from "./context/ctxBuilders/IMSummaryCtxBuilder";
import { AIDigestResult } from "@root/common/contracts/ai-model";
import { AGCDBManager } from "@root/common/database/AGCDBManager";
import { IMDBManager } from "@root/common/database/IMDBManager";
import { InterestScoreDBManager } from "@root/common/database/InterestScoreDBManager";
import { getHoursAgoTimestamp, getMinutesAgoTimestamp } from "@root/common/util/TimeUtils";
import getRandomHash from "@root/common/util/getRandomHash";
import Logger from "@root/common/util/Logger";
import { ProcessedChatMessageWithRawMessage } from "@root/common/contracts/data-provider";
import { registerConfigManagerService, getConfigManagerService } from "@root/common/di/container";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { TaskHandlerTypes, TaskParameters } from "@root/common/scheduler/@types/Tasks";
import { checkConnectivity } from "@root/common/util/network/checkConnectivity";
import { SemanticRater } from "./misc/SemanticRater";
import { OllamaEmbeddingService } from "./embedding/OllamaEmbeddingService";
import { VectorDBManager } from "./embedding/VectorDBManager";
import { RagRPCImpl, startRAGRPCServer } from "./rpc/index";
import { RAGCtxBuilder } from "./context/ctxBuilders/RAGCtxBuilder";

(async () => {
    // 初始化 DI 容器
    registerConfigManagerService();
    const configManagerService = getConfigManagerService();

    const LOGGER = Logger.withTag("🤖 ai-model-root-script");

    const imdbManager = new IMDBManager();
    await imdbManager.init();
    const agcDBManager = new AGCDBManager();
    await agcDBManager.init();
    const interestScoreDBManager = new InterestScoreDBManager();
    await interestScoreDBManager.init();

    let config = await configManagerService.getCurrentConfig();

    // 初始化向量数据库管理器
    const vectorDBManager = new VectorDBManager(
        config.ai.embedding.vectorDBPath,
        config.ai.embedding.dimension
    );
    await vectorDBManager.init();

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
                        LOGGER.error(`原始请求ctx为：`);
                        console.log(ctx);
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
            agendaInstance.now(TaskHandlerTypes.DecideAndDispatchInterestScore);
        },
        {
            concurrency: 1,
            priority: "high",
            lockLifetime: 10 * 60 * 1000 // 10分钟
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

    await agendaInstance
        .create(TaskHandlerTypes.InterestScore)
        .unique({ name: TaskHandlerTypes.InterestScore }, { insertOnly: true })
        .save();
    agendaInstance.define<TaskParameters<TaskHandlerTypes.InterestScore>>(
        TaskHandlerTypes.InterestScore,
        async job => {
            LOGGER.info(`😋开始处理任务: ${job.attrs.name}`);
            const attrs = job.attrs.data;
            config = await configManagerService.getCurrentConfig(); // 刷新配置

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
            // 触发向量嵌入生成任务
            agendaInstance.now(TaskHandlerTypes.DecideAndDispatchGenerateEmbedding);
        },
        {
            concurrency: 1,
            priority: "high",
            lockLifetime: 10 * 60 * 1000 // 10分钟
        }
    );

    await agendaInstance
        .create(TaskHandlerTypes.DecideAndDispatchInterestScore)
        .unique({ name: TaskHandlerTypes.DecideAndDispatchInterestScore }, { insertOnly: true })
        .save();
    agendaInstance.define<TaskParameters<TaskHandlerTypes.DecideAndDispatchInterestScore>>(
        TaskHandlerTypes.DecideAndDispatchInterestScore,
        async job => {
            LOGGER.info(`😋开始处理任务: ${job.attrs.name}`);
            config = await configManagerService.getCurrentConfig(); // 刷新配置

            await agendaInstance.now(TaskHandlerTypes.InterestScore, {
                startTimeStamp: getHoursAgoTimestamp(24 * 3),
                endTimeStamp: Date.now() // 现在
            });

            LOGGER.success(`🥳任务完成: ${job.attrs.name}`);
        }
    );

    // ========== 向量嵌入生成任务 ==========

    await agendaInstance
        .create(TaskHandlerTypes.GenerateEmbedding)
        .unique({ name: TaskHandlerTypes.GenerateEmbedding }, { insertOnly: true })
        .save();
    agendaInstance.define<TaskParameters<TaskHandlerTypes.GenerateEmbedding>>(
        TaskHandlerTypes.GenerateEmbedding,
        async job => {
            LOGGER.info(`😋开始处理任务: ${job.attrs.name}`);
            const attrs = job.attrs.data;
            config = await configManagerService.getCurrentConfig(); // 刷新配置

            // 初始化 Ollama 嵌入服务
            const embeddingService = new OllamaEmbeddingService(
                config.ai.embedding.ollamaBaseURL,
                config.ai.embedding.model,
                config.ai.embedding.dimension
            );

            // 检查 Ollama 服务是否可用
            if (!(await embeddingService.isAvailable())) {
                LOGGER.error("Ollama 服务不可用，跳过当前任务");
                return;
            }

            // 获取时间范围内的所有 sessionId
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

            // 获取所有 digest 结果
            const digestResults = [] as AIDigestResult[];
            for (const sessionId of sessionIds) {
                digestResults.push(
                    ...(await agcDBManager.getAIDigestResultsBySessionId(sessionId))
                );
            }
            LOGGER.info(`共获取到 ${digestResults.length} 条摘要结果`);

            // 过滤出未生成嵌入的 topicId
            const allTopicIds = digestResults.map(r => r.topicId);
            const topicIdsWithoutEmbedding = vectorDBManager.filterWithoutEmbedding(allTopicIds);
            LOGGER.info(`其中 ${topicIdsWithoutEmbedding.length} 条需要生成嵌入向量`);

            if (topicIdsWithoutEmbedding.length === 0) {
                LOGGER.info("没有需要生成嵌入的话题，任务完成");
                return;
            }

            // 构建待处理的 digest 映射
            const digestMap = new Map<string, AIDigestResult>();
            for (const digest of digestResults) {
                digestMap.set(digest.topicId, digest);
            }

            // 按批次处理
            const batchSize = config.ai.embedding.batchSize;
            for (let i = 0; i < topicIdsWithoutEmbedding.length; i += batchSize) {
                await job.touch(); // 保证任务存活

                const batchTopicIds = topicIdsWithoutEmbedding.slice(i, i + batchSize);
                LOGGER.info(
                    `处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(topicIdsWithoutEmbedding.length / batchSize)}，共 ${batchTopicIds.length} 条`
                );

                // 构建输入文本
                const texts = batchTopicIds.map(topicId => {
                    const digest = digestMap.get(topicId)!;
                    return `话题：${digest.topic} 正文内容：${digest.detail}`;
                });

                try {
                    // 批量生成嵌入向量
                    const embeddings = await embeddingService.embedBatch(texts);

                    // 批量存储
                    const items = batchTopicIds.map((topicId, idx) => ({
                        topicId,
                        embedding: embeddings[idx]
                    }));
                    vectorDBManager.storeEmbeddings(items);

                    LOGGER.success(`批次处理完成，已存储 ${items.length} 条向量`);
                } catch (error) {
                    LOGGER.error(`批次处理失败: ${error}`);
                    // 继续处理下一批次，不中断整个任务
                }
            }

            LOGGER.success(
                `🥳任务完成: ${job.attrs.name}，向量数据库当前共 ${vectorDBManager.getCount()} 条记录`
            );
        },
        {
            concurrency: 1,
            priority: "high",
            lockLifetime: 10 * 60 * 1000 // 10分钟
        }
    );

    await agendaInstance
        .create(TaskHandlerTypes.DecideAndDispatchGenerateEmbedding)
        .unique({ name: TaskHandlerTypes.DecideAndDispatchGenerateEmbedding }, { insertOnly: true })
        .save();
    agendaInstance.define<TaskParameters<TaskHandlerTypes.DecideAndDispatchGenerateEmbedding>>(
        TaskHandlerTypes.DecideAndDispatchGenerateEmbedding,
        async job => {
            LOGGER.info(`😋开始处理任务: ${job.attrs.name}`);
            config = await configManagerService.getCurrentConfig(); // 刷新配置

            await agendaInstance.now(TaskHandlerTypes.GenerateEmbedding, {
                startTimeStamp: getHoursAgoTimestamp(24 * 3), // 3天前
                endTimeStamp: Date.now() // 现在
            });

            LOGGER.success(`🥳任务完成: ${job.attrs.name}`);
        }
    );

    // ========== 启动 RPC Server ==========

    // 初始化 Ollama 嵌入服务（用于 RPC 查询）
    const embeddingService = new OllamaEmbeddingService(
        config.ai.embedding.ollamaBaseURL,
        config.ai.embedding.model,
        config.ai.embedding.dimension
    );

    // 初始化 TextGenerator（用于 RAG 问答）
    const textGenerator = new TextGenerator();
    await textGenerator.init();

    // 创建 RPC 实现
    const ragCtxBuilder = new RAGCtxBuilder();
    await ragCtxBuilder.init();
    const rpcImpl = new RagRPCImpl(
        vectorDBManager,
        embeddingService,
        agcDBManager,
        textGenerator,
        config.ai.defaultModelName,
        ragCtxBuilder
    );

    // 启动 RPC 服务器
    const rpcPort = config.ai.rpc?.port || 7979;
    startRAGRPCServer(rpcImpl, rpcPort);

    LOGGER.success("Ready to start agenda scheduler");
    await agendaInstance.start(); // 👈 启动调度器
})();
