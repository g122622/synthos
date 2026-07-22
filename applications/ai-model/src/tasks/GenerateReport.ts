import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import Logger from "@root/common/util/Logger";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import { checkConnectivity } from "@root/common/util/network/checkConnectivity";
import { AgcDbAccessService } from "@root/common/services/database/AgcDbAccessService";
import { ReportDbAccessService } from "@root/common/services/database/ReportDbAccessService";
import { InterestScoreDbAccessService } from "@root/common/services/database/InterestScoreDbAccessService";
import { Report, ReportStatistics, ReportType } from "@root/common/contracts/report";
import getRandomHash from "@root/common/util/math/getRandomHash";
import { GenerateReportInput, GenerateReportOutput } from "@root/common/rpc/ai-model/index";
import { COMMON_TOKENS } from "@root/common/di/tokens";

import { ReportPromptStore } from "../context/prompts/ReportPromptStore";
import { AI_MODEL_TOKENS } from "../di/tokens";
import { ReportEmailService } from "../services/email/ReportEmailService";
import { TextGeneratorService } from "../services/generators/text/TextGeneratorService";

/**
 * 日报生成任务处理器
 * 负责生成各类日报（半日报、周报、月报）
 */
@injectable()
export class GenerateReportTaskHandler {
    private LOGGER = Logger.withTag("📰 GenerateReportTask");

    public constructor(
        @inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService,
        @inject(COMMON_TOKENS.AgcDbAccessService) private agcDbAccessService: AgcDbAccessService,
        @inject(COMMON_TOKENS.ReportDbAccessService) private reportDbAccessService: ReportDbAccessService,
        @inject(COMMON_TOKENS.InterestScoreDbAccessService)
        private interestScoreDbAccessService: InterestScoreDbAccessService,
        @inject(AI_MODEL_TOKENS.ReportEmailService) private reportEmailService: ReportEmailService,
        @inject(AI_MODEL_TOKENS.TextGeneratorService) private textGeneratorService: TextGeneratorService
    ) {}

    /**
     * 执行日报生成任务
     * @param params 任务参数
     * @returns 执行结果（含生成的 reportId）
     */
    public async run(params: GenerateReportInput): Promise<GenerateReportOutput> {
        this.LOGGER.info(`📰 开始处理日报生成任务: ${params.reportType}`);

        const config = await this.configManagerService.getCurrentConfig();

        // 检查日报功能是否启用
        if (!config.report.enabled) {
            this.LOGGER.info("日报功能未启用，跳过任务");

            return { success: true, reportId: "" };
        }

        const { reportType, timeStart, timeEnd } = params;

        // 检查是否已存在该时间段的日报
        if (await this.reportDbAccessService.isReportExists(reportType, timeStart, timeEnd)) {
            this.LOGGER.info(
                `${reportType} 日报已存在 (${new Date(timeStart).toISOString()} - ${new Date(timeEnd).toISOString()})，跳过`
            );

            // 幂等跳过：返回一个占位 reportId（实际未新生成）
            return { success: true, reportId: "" };
        }

        const periodDescription = this.formatPeriodDescription(reportType, timeStart, timeEnd);

        this.LOGGER.info(`正在生成 ${periodDescription} 的日报...`);

        try {
            // 1. 获取该时间段内的所有 AI 摘要结果
            const allDigestResults = await this.agcDbAccessService.selectAll();
            const digestResults = allDigestResults.filter(
                result => result.updateTime >= timeStart && result.updateTime <= timeEnd
            );

            // 2. 获取兴趣度评分，过滤掉负分话题
            const topicIds = digestResults.map(r => r.topicId);
            const interestScores = new Map<string, number>();

            for (const topicId of topicIds) {
                const score = await this.interestScoreDbAccessService.getInterestScoreResult(topicId);

                if (score !== null) {
                    interestScores.set(topicId, score);
                }
            }

            // 过滤掉兴趣度低于阈值的话题（若不存在兴趣度评分，则保留）
            const interestScoreThreshold = config.report.generation.interestScoreThreshold;
            const filteredResults = digestResults.filter(result => {
                const score = interestScores.get(result.topicId);

                return score === undefined || score >= interestScoreThreshold;
            });

            // 3. 检查是否有话题
            if (filteredResults.length === 0) {
                this.LOGGER.info(`${periodDescription} 没有有效话题，生成空日报`);

                const emptyReport: Report = {
                    reportId: getRandomHash(16),
                    type: reportType,
                    timeStart,
                    timeEnd,
                    isEmpty: true,
                    summary: ReportPromptStore.getEmptyReportText(periodDescription),
                    summaryGeneratedAt: Date.now(),
                    summaryStatus: "success",
                    model: "",
                    statistics: { topicCount: 0, mostActiveGroups: [], mostActiveHour: 0 },
                    topicIds: [],
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };

                await this.reportDbAccessService.storeReport(emptyReport);
                this.LOGGER.success(`${periodDescription} 空日报生成完成`);

                // 发送空日报邮件
                try {
                    await this.reportEmailService.sendReportEmail(emptyReport);
                } catch (emailError) {
                    this.LOGGER.warning(`发送空日报邮件失败: ${emailError}`);
                }

                return { success: true, reportId: emptyReport.reportId };
            }

            // 4. 按兴趣度排序，取 Top N
            const topN = config.report.generation.topNTopics;
            const sortedResults = [...filteredResults]
                .sort((a, b) => {
                    const scoreA = interestScores.get(a.topicId) ?? 0;
                    const scoreB = interestScores.get(b.topicId) ?? 0;

                    return scoreB - scoreA;
                })
                .slice(0, topN);

            // 5. 构建 sessionId -> groupId 映射（用于统计）
            const sessionGroupMap = new Map<string, string>();
            // 从配置中获取所有群组
            const groupIds = Object.keys(config.groupConfigs);

            for (const result of sortedResults) {
                // TODO 修正这部分逻辑
                // 暂时将 sessionId 的前缀作为 groupId（简化实现）
                // 实际项目中可能需要从 ImDbAccessService 查询
                for (const groupId of groupIds) {
                    if (result.sessionId.includes(groupId)) {
                        sessionGroupMap.set(result.sessionId, groupId);
                        break;
                    }
                }
            }

            // 6. 计算统计数据
            const topicsWithGroupId = sortedResults.map(r => ({
                ...r,
                groupId: sessionGroupMap.get(r.sessionId)
            }));
            const statistics = this.calculateStatistics(topicsWithGroupId, sessionGroupMap);

            // 7. 准备话题数据给 LLM
            const topicsData = sortedResults.map(r => ({
                topic: r.topic,
                detail: r.detail
            }));

            // 8. 检查网络连接
            if (!(await checkConnectivity())) {
                this.LOGGER.error("网络连接不可用，跳过 LLM 综述生成");

                const report: Report = {
                    reportId: getRandomHash(16),
                    type: reportType,
                    timeStart,
                    timeEnd,
                    isEmpty: false,
                    summary: "",
                    summaryGeneratedAt: 0,
                    summaryStatus: "pending",
                    model: "",
                    statistics,
                    topicIds: sortedResults.map(r => r.topicId),
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };

                await this.reportDbAccessService.storeReport(report);

                return { success: true, reportId: report.reportId };
            }

            // 9. 调用 LLM 生成综述
            const prompt = (
                await ReportPromptStore.getReportSummaryPrompt(
                    reportType,
                    periodDescription,
                    topicsData,
                    statistics
                )
            ).serializeToString();
            let summary = "";
            let selectedModelName = "";
            let summaryStatus: "success" | "failed" = "failed";
            const retryCount = config.report.generation.llmRetryCount;
            const modelCandidates = config.report.generation.aiModels;

            this.LOGGER.info(`开始调用 LLM 生成日报综述，prompt长度：${prompt.length}`);

            for (let attempt = 0; attempt <= retryCount; attempt++) {
                try {
                    const result = await this.textGeneratorService.generateTextWithModelCandidates(
                        modelCandidates,
                        prompt
                    );

                    summary = result.content;
                    selectedModelName = result.selectedModelName;
                    summaryStatus = "success";
                    this.LOGGER.success(`日报综述生成成功，使用模型: ${selectedModelName}`);
                    break;
                } catch (error) {
                    this.LOGGER.warning(`第 ${attempt + 1} 次尝试生成综述失败: ${error}`);
                    if (attempt === retryCount) {
                        this.LOGGER.error(`所有重试均失败，日报综述生成失败`);
                    }
                }
            }

            this.textGeneratorService.dispose();

            // 10. 保存日报
            const report: Report = {
                reportId: getRandomHash(16),
                type: reportType,
                timeStart,
                timeEnd,
                isEmpty: false,
                summary,
                summaryGeneratedAt: Date.now(),
                summaryStatus,
                model: selectedModelName,
                statistics,
                topicIds: sortedResults.map(r => r.topicId),
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            await this.reportDbAccessService.storeReport(report);
            this.LOGGER.success(`📰 ${periodDescription} 日报生成完成！话题数: ${statistics.topicCount}`);

            // 发送日报邮件（仅当综述生成成功时）
            if (summaryStatus === "success") {
                try {
                    await this.reportEmailService.sendReportEmail(report);
                } catch (emailError) {
                    this.LOGGER.error(`发送日报邮件失败: ${emailError}`);
                }
            }

            return { success: true, reportId: report.reportId };
        } catch (error) {
            this.LOGGER.error(`日报生成失败: ${error}`);
            throw error;
        }
    }

    /**
     * 格式化时间段描述
     */
    private formatPeriodDescription(type: ReportType, timeStart: number, timeEnd: number): string {
        const startDate = new Date(timeStart);
        const endDate = new Date(timeEnd);

        const formatDate = (d: Date) => `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;

        if (type === "half-daily") {
            const hour = startDate.getHours();
            const period = hour < 12 ? "上午" : "下午";

            return `${formatDate(startDate)} ${period}`;
        } else if (type === "weekly") {
            return `${formatDate(startDate)} - ${formatDate(endDate)} 周报`;
        } else {
            return `${formatDate(startDate)} - ${formatDate(endDate)} 月报`;
        }
    }

    /**
     * 计算统计数据
     */
    private calculateStatistics(
        topics: {
            topicId: string;
            sessionId: string;
            topic: string;
            detail: string;
            updateTime: number;
            groupId?: string;
        }[],
        sessionGroupMap: Map<string, string>
    ): ReportStatistics {
        // 计算最活跃群组
        const groupTopicCount = new Map<string, number>();

        for (const topic of topics) {
            const groupId = topic.groupId || sessionGroupMap.get(topic.sessionId) || "unknown";

            groupTopicCount.set(groupId, (groupTopicCount.get(groupId) || 0) + 1);
        }

        const sortedGroups = Array.from(groupTopicCount.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([groupId]) => groupId);

        // 计算最活跃时段
        const hourCount = new Map<number, number>();

        for (const topic of topics) {
            const hour = new Date(topic.updateTime).getHours();

            hourCount.set(hour, (hourCount.get(hour) || 0) + 1);
        }

        let mostActiveHour = 0;
        let maxCount = 0;

        for (const [hour, count] of hourCount.entries()) {
            if (count > maxCount) {
                maxCount = count;
                mostActiveHour = hour;
            }
        }

        return {
            topicCount: topics.length,
            mostActiveGroups: sortedGroups,
            mostActiveHour
        };
    }
}
