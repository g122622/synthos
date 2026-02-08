import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import { agendaInstance } from "@root/common/scheduler/agenda";
import Logger from "@root/common/util/Logger";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import { AgcDbAccessService } from "@root/common/services/database/AgcDbAccessService";
import { AIDigestResult } from "@root/common/contracts/ai-model";
import { InterestScoreDbAccessService } from "@root/common/services/database/InterestScoreDbAccessService";
import { COMMON_TOKENS } from "@root/common/di/tokens";

import { SemanticRater } from "../misc/SemanticRater";
import { EmbeddingService } from "../services/embedding/EmbeddingService";
import { AI_MODEL_TOKENS } from "../di/tokens";

/**
 * 兴趣度评分任务处理器
 * 负责对 AI 摘要结果进行兴趣度评分
 */
@injectable()
export class InterestScoreTaskHandler {
    private LOGGER = Logger.withTag("🤖 InterestScoreTask");

    public constructor(
        @inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService,
        @inject(COMMON_TOKENS.ImDbAccessService) private imDbAccessService: ImDbAccessService,
        @inject(COMMON_TOKENS.AgcDbAccessService) private agcDbAccessService: AgcDbAccessService,
        @inject(COMMON_TOKENS.InterestScoreDbAccessService)
        private interestScoreDbAccessService: InterestScoreDbAccessService,
        @inject(AI_MODEL_TOKENS.EmbeddingService) private embeddingService: EmbeddingService
    ) {}

    /**
     * 注册任务到 Agenda 调度器
     */
    public async register(): Promise<void> {
        let config = await this.configManagerService.getCurrentConfig();

        await agendaInstance
            .create(TaskHandlerTypes.InterestScore)
            .unique({ name: TaskHandlerTypes.InterestScore }, { insertOnly: true })
            .save();

        agendaInstance.define<TaskParameters<TaskHandlerTypes.InterestScore>>(
            TaskHandlerTypes.InterestScore,
            async job => {
                this.LOGGER.info(`😋开始处理任务: ${job.attrs.name}`);
                const attrs = job.attrs.data;

                config = await this.configManagerService.getCurrentConfig(); // 刷新配置

                // 检查 Ollama 服务是否可用
                if (!(await this.embeddingService.isAvailable())) {
                    this.LOGGER.error("Ollama 服务不可用，跳过当前任务");

                    return;
                }

                const sessionIds = [] as string[];

                for (const groupId of Object.keys(config.groupConfigs)) {
                    sessionIds.push(
                        ...(await this.imDbAccessService.getSessionIdsByGroupIdAndTimeRange(
                            groupId,
                            attrs.startTimeStamp,
                            attrs.endTimeStamp
                        ))
                    );
                }

                const digestResults = [] as AIDigestResult[];

                for (const sessionId of sessionIds) {
                    digestResults.push(
                        ...(await this.agcDbAccessService.getAIDigestResultsBySessionId(sessionId))
                    );
                }
                this.LOGGER.info(`共获取到 ${digestResults.length} 可能需要打分的摘要结果`);

                // 过滤掉已经计算过兴趣度的结果
                const filteredDigestResults = [];

                for (const digestResult of digestResults) {
                    const exists = await this.interestScoreDbAccessService.isInterestScoreResultExist(
                        digestResult.topicId
                    );

                    if (!exists) {
                        filteredDigestResults.push(digestResult);
                    }
                }
                this.LOGGER.info(`还剩 ${filteredDigestResults.length} 条需要打分的摘要结果`);
                if (filteredDigestResults.length === 0) {
                    this.LOGGER.info("没有需要打分的摘要结果，跳过当前任务");

                    return;
                }

                const rater = new SemanticRater(this.embeddingService);
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

                // 构建所有话题详情文本
                const topics = filteredDigestResults.map(
                    digestResult => `话题：${digestResult.topic} 正文内容：${digestResult.detail}`
                );

                // 批量获取所有话题的分数
                await job.touch(); // 保证任务存活
                const scores = await rater.scoreTopics(argArr, topics);

                // 存储所有分数结果
                for (let i = 0; i < filteredDigestResults.length; i++) {
                    await this.interestScoreDbAccessService.storeInterestScoreResult(
                        filteredDigestResults[i].topicId,
                        scores[i]
                    );
                }

                this.LOGGER.success(`🥳任务完成: ${job.attrs.name}`);
            },
            {
                concurrency: 1,
                priority: "high",
                lockLifetime: 10 * 60 * 1000 // 10分钟
            }
        );
    }
}
