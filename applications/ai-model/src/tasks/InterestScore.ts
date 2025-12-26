import { agendaInstance } from "@root/common/scheduler/agenda";
import { TaskHandlerTypes, TaskParameters } from "@root/common/scheduler/@types/Tasks";
import Logger from "@root/common/util/Logger";
import { getConfigManagerService } from "@root/common/di/container";
import { IMDBManager } from "@root/common/database/IMDBManager";
import { AGCDBManager } from "@root/common/database/AGCDBManager";
import { AIDigestResult } from "@root/common/contracts/ai-model";
import { SemanticRater } from "../misc/SemanticRater";
import { OllamaEmbeddingService } from "../embedding/OllamaEmbeddingService";
import { InterestScoreDBManager } from "@root/common/database/InterestScoreDBManager";

export async function setupInterestScoreTask(
    imdbManager: IMDBManager,
    agcDBManager: AGCDBManager,
    interestScoreDBManager: InterestScoreDBManager
) {
    const LOGGER = Logger.withTag("🤖 [ai-model-root-script] [InterestScoreTask]");
    const configManagerService = getConfigManagerService();
    let config = await configManagerService.getCurrentConfig(); // 初始化配置

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
            LOGGER.info(`共获取到 ${digestResults.length} 可能需要打分的摘要结果`);

            // 过滤掉已经计算过兴趣度的结果
            const filteredDigestResults = digestResults.filter(
                digestResult =>
                    !interestScoreDBManager.isInterestScoreResultExist(digestResult.topicId)
            );
            LOGGER.info(`还剩 ${filteredDigestResults.length} 条需要打分的摘要结果`);
            if (filteredDigestResults.length === 0) {
                LOGGER.info("没有需要打分的摘要结果，跳过当前任务");
                return;
            }

            const rater = new SemanticRater(embeddingService);
            for (const digestResult of filteredDigestResults) {
                await job.touch(); // 保证任务存活
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
}
