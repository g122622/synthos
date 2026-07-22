/**
 * Pipeline 执行器
 * 串行调用各 worker 的 tRPC procedure 完成数据处理流水线
 * 通过进程内互斥锁保证同一时刻只有一个 Pipeline 运行
 */
import { injectable } from "tsyringe";
import Logger from "@root/common/util/Logger";
import ConfigManagerService from "@root/common/services/config/ConfigManagerService";
import { getHoursAgoTimestamp } from "@root/common/util/TimeUtils";
import { IMTypes } from "@root/common/contracts/data-provider/index";

import { DataProviderClient, PreprocessingClient, AIModelClient } from "../rpc/clients";

const LOGGER = Logger.withTag("🎭 PipelineRunner");

/**
 * Pipeline 执行顺序（严格串行）:
 * 1. ProvideData - 获取原始数据
 * 2. Preprocess - 预处理数据
 * 3. AISummarize - AI 摘要生成
 * 4. GenerateEmbedding - 生成向量嵌入
 * 5. InterestScore - 计算兴趣度评分（暂未启用）
 * 6. LLMInterestEvaluationAndNotification - LLM智能兴趣评估与邮件通知（暂未启用）
 */
@injectable()
export class PipelineRunner {
    /** 互斥锁：保证同一时刻只有一个 Pipeline 运行 */
    private running = false;

    public constructor(
        private dataProviderClient: DataProviderClient,
        private preprocessingClient: PreprocessingClient,
        private aiModelClient: AIModelClient
    ) {}

    /**
     * 执行一次完整 Pipeline
     * 任一步骤失败即终止并抛出错误
     */
    public async runPipeline(): Promise<void> {
        if (this.running) {
            LOGGER.warning("Pipeline 已在运行中，跳过本次触发");

            return;
        }

        this.running = true;

        try {
            LOGGER.info("🚀 开始执行 Pipeline");

            const config = await ConfigManagerService.getCurrentConfig();
            const startTimeStamp = getHoursAgoTimestamp(config.orchestrator.dataSeekTimeWindowInHours); // 如果是负数则代表自动获取时间范围
            const endTimeStamp = Date.now();
            const groupIds = Object.keys(config.groupConfigs);

            LOGGER.info(`Pipeline 配置 - 处理群组: ${groupIds.join(", ")}`);

            // ==================== 步骤 1: ProvideData ====================
            LOGGER.info("📥 [1/4] 开始执行 ProvideData 任务...");
            await this.dataProviderClient.provideData.mutate({
                IMType: IMTypes.QQ, // TODO: 支持多种 IM 类型
                groupIds,
                startTimeStamp: -1,
                endTimeStamp
            });
            LOGGER.success("✅ ProvideData 任务完成");

            // ==================== 步骤 2: Preprocess ====================
            LOGGER.info("🔧 [2/4] 开始执行 Preprocess 任务...");
            await this.preprocessingClient.preprocess.mutate({
                groupIds,
                startTimeStamp,
                endTimeStamp
            });
            LOGGER.success("✅ Preprocess 任务完成");

            // ==================== 步骤 3: AISummarize ====================
            LOGGER.info("🤖 [3/4] 开始执行 AISummarize 任务...");
            await this.aiModelClient.aiSummarize.mutate({
                groupIds,
                startTimeStamp,
                endTimeStamp
            });
            LOGGER.success("✅ AISummarize 任务完成");

            // ==================== 步骤 4: GenerateEmbedding ====================
            LOGGER.info("📐 [4/4] 开始执行 GenerateEmbedding 任务...");
            await this.aiModelClient.generateEmbedding.mutate({
                startTimeStamp,
                endTimeStamp
            });
            LOGGER.success("✅ GenerateEmbedding 任务完成");

            // ==================== 步骤 5/6（InterestScore / LLMInterestEvaluation）暂未启用 ====================

            LOGGER.success("🎉 Pipeline 全部完成！");
        } catch (error) {
            LOGGER.error(`❌ Pipeline 执行失败: ${error}`);
            throw error;
        } finally {
            this.running = false;
        }
    }
}
