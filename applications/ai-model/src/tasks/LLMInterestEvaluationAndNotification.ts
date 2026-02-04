import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { TaskHandlerTypes, TaskParameters } from "@root/common/scheduler/@types/Tasks";
import Logger from "@root/common/util/Logger";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import { AgcDbAccessService } from "@root/common/services/database/AgcDbAccessService";
import { AIDigestResult } from "@root/common/contracts/ai-model";
import { TextGeneratorService } from "../services/generators/text/TextGeneratorService";
import { InterestPromptStore } from "../context/prompts/InterestPromptStore";
import { InterestEmailService } from "../services/email/InterestEmailService";
import { COMMON_TOKENS } from "@root/common/di/tokens";
import { AI_MODEL_TOKENS } from "../di/tokens";
import { retryAsync } from "@root/common/util/retryAsync";

/**
 * LLM兴趣评估与通知任务处理器
 * 负责使用LLM对话题进行智能兴趣评估，并通过邮件通知用户感兴趣的话题
 */
@injectable()
export class LLMInterestEvaluationAndNotificationTaskHandler {
    private LOGGER = Logger.withTag("🤖 LLMInterestEvaluationTask");

    public constructor(
        @inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService,
        @inject(COMMON_TOKENS.ImDbAccessService) private imDbAccessService: ImDbAccessService,
        @inject(COMMON_TOKENS.AgcDbAccessService) private agcDbAccessService: AgcDbAccessService,
        @inject(AI_MODEL_TOKENS.TextGeneratorService) private textGeneratorService: TextGeneratorService,
        @inject(AI_MODEL_TOKENS.InterestEmailService) private interestEmailService: InterestEmailService
    ) {}

    /**
     * 注册任务到 Agenda 调度器
     */
    public async register(): Promise<void> {
        let config = await this.configManagerService.getCurrentConfig();

        await agendaInstance
            .create(TaskHandlerTypes.LLMInterestEvaluationAndNotification)
            .unique({ name: TaskHandlerTypes.LLMInterestEvaluationAndNotification }, { insertOnly: true })
            .save();

        agendaInstance.define<TaskParameters<TaskHandlerTypes.LLMInterestEvaluationAndNotification>>(
            TaskHandlerTypes.LLMInterestEvaluationAndNotification,
            async job => {
                this.LOGGER.info(`😋开始处理任务: ${job.attrs.name}`);
                const attrs = job.attrs.data;
                config = await this.configManagerService.getCurrentConfig(); // 刷新配置

                // 获取配置
                const llmEvaluationDescriptions = config.ai.interestScore.llmEvaluationDescriptions;
                const batchSize = config.ai.interestScore.llmEvaluationBatchSize;

                // 检查配置是否有效
                if (!llmEvaluationDescriptions || llmEvaluationDescriptions.length === 0) {
                    this.LOGGER.warning("未配置 llmEvaluationDescriptions，跳过任务");
                    return;
                }

                // 1. 获取指定时间范围内的所有摘要结果
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

                const allDigestResults = [] as AIDigestResult[];
                for (const sessionId of sessionIds) {
                    allDigestResults.push(
                        ...(await this.agcDbAccessService.getAIDigestResultsBySessionId(sessionId))
                    );
                }
                this.LOGGER.info(`共获取到 ${allDigestResults.length} 条摘要结果`);

                if (allDigestResults.length === 0) {
                    this.LOGGER.info("没有可评估的摘要结果，跳过任务");
                    return;
                }

                // 2. 分批处理话题评估
                const interestedTopics: AIDigestResult[] = [];

                for (let i = 0; i < allDigestResults.length; i += batchSize) {
                    const batch = allDigestResults.slice(i, i + batchSize);
                    this.LOGGER.info(`正在处理第 ${Math.floor(i / batchSize) + 1} 批，共 ${batch.length} 个话题`);

                    // 调用LLM进行评估
                    const evaluationResults = await this._evaluateTopicsBatch(
                        llmEvaluationDescriptions,
                        batch,
                        config.ai.defaultModelName
                    );

                    // 筛选出感兴趣的话题
                    for (let j = 0; j < batch.length; j++) {
                        if (evaluationResults[j]) {
                            interestedTopics.push(batch[j]);
                        }
                    }

                    await job.touch(); // 保证任务存活
                }

                this.LOGGER.info(`共发现 ${interestedTopics.length} 个感兴趣的话题`);

                // 3. 发送邮件通知
                if (interestedTopics.length > 0) {
                    const emailSuccess = await this.interestEmailService.sendInterestTopicsEmail(interestedTopics);
                    if (emailSuccess) {
                        this.LOGGER.success("邮件通知发送成功");
                    } else {
                        this.LOGGER.warning("邮件通知发送失败");
                    }
                }

                this.LOGGER.success(`🥳任务完成: ${job.attrs.name}`);
            },
            {
                concurrency: 1,
                priority: "normal",
                lockLifetime: 10 * 60 * 1000 // 10分钟
            }
        );
    }

    /**
     * 批量评估话题的兴趣度
     * @param userInterestDescriptions 用户感兴趣的内容描述列表
     * @param topics 待评估的话题列表
     * @param modelName LLM模型名称
     * @returns boolean数组，每个元素表示对应话题是否感兴趣
     */
    private async _evaluateTopicsBatch(
        userInterestDescriptions: string[],
        topics: AIDigestResult[],
        modelName: string
    ): Promise<boolean[]> {
        // 构建提示词
        const topicsForPrompt = topics.map(t => ({
            topic: t.topic,
            detail: t.detail
        }));

        const promptNode = InterestPromptStore.getLLMInterestEvaluationPrompt(
            userInterestDescriptions,
            topicsForPrompt
        );
        const prompt = promptNode.toString();

        // 使用重试机制调用LLM
        const responseText = await retryAsync(
            async () => {
                const result = await this.textGeneratorService.generateTextWithModelCandidates(
                    [modelName],
                    prompt,
                    false
                );

                // 验证返回的JSON格式
                const parsed = this._parseAndValidateResponse(result.content, topics.length);

                // 如果验证通过，返回原始响应文本
                return result.content;
            },
            {
                maxRetries: 3,
                retryDelayMs: 2000,
                taskName: "LLM兴趣评估"
            }
        );

        // 解析最终响应
        return this._parseAndValidateResponse(responseText, topics.length);
    }

    /**
     * 解析并验证LLM响应
     * @param responseText LLM返回的文本
     * @param expectedLength 期望的数组长度
     * @returns boolean数组
     * @throws 如果解析失败或长度不匹配则抛出错误
     */
    private _parseAndValidateResponse(responseText: string, expectedLength: number): boolean[] {
        try {
            // 尝试从响应中提取JSON数组
            const jsonMatch = responseText.match(/\[[\s\S]*?\]/);
            if (!jsonMatch) {
                throw new Error("LLM响应中未找到JSON数组");
            }

            const parsed = JSON.parse(jsonMatch[0]);

            // 验证是否为数组
            if (!Array.isArray(parsed)) {
                throw new Error("LLM响应不是数组格式");
            }

            // 验证数组长度
            if (parsed.length !== expectedLength) {
                throw new Error(`LLM返回的数组长度（${parsed.length}）与期望长度（${expectedLength}）不匹配`);
            }

            // 验证数组元素都是boolean
            const allBoolean = parsed.every(item => typeof item === "boolean");
            if (!allBoolean) {
                throw new Error("LLM返回的数组中包含非boolean类型的元素");
            }

            return parsed as boolean[];
        } catch (error) {
            this.LOGGER.error(`解析LLM响应失败: ${error}`);
            this.LOGGER.error(`原始响应: ${responseText}`);
            throw error;
        }
    }
}
