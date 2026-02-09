import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import z from "zod";
import Logger from "@root/common/util/Logger";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import { AgcDbAccessService } from "@root/common/services/database/AgcDbAccessService";
import { AIDigestResult } from "@root/common/contracts/ai-model";
import { COMMON_TOKENS } from "@root/common/di/tokens";
import { registerTask } from "@root/common/scheduler/registry/index";
import {
    GenerateEmbeddingTaskDefinition,
    GroupedTimeRangeParamsSchema
} from "@root/common/scheduler/taskDefinitions/index";
import { Runnable } from "@root/common/util/type/Runnable";

import { EmbeddingService } from "../services/embedding/EmbeddingService";
import { VectorDBManagerService } from "../services/embedding/VectorDBManagerService";
import { anonymizeDigestDetail } from "../utils/anonymizeDigestDetail";
import { AI_MODEL_TOKENS } from "../di/tokens";

/**
 * 向量嵌入生成任务处理器
 * 负责为 AI 摘要结果生成向量嵌入
 */
@injectable()
@registerTask(GenerateEmbeddingTaskDefinition)
export class GenerateEmbeddingTaskHandler implements Runnable {
    private LOGGER = Logger.withTag("🤖 GenerateEmbeddingTask");

    public constructor(
        @inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService,
        @inject(COMMON_TOKENS.ImDbAccessService) private imDbAccessService: ImDbAccessService,
        @inject(COMMON_TOKENS.AgcDbAccessService) private agcDbAccessService: AgcDbAccessService,
        @inject(AI_MODEL_TOKENS.VectorDBManagerService) private vectorDBManagerService: VectorDBManagerService,
        @inject(AI_MODEL_TOKENS.EmbeddingService) private embeddingService: EmbeddingService
    ) {}

    /**
     * 执行任务
     */
    public async run(params: z.infer<typeof GroupedTimeRangeParamsSchema>): Promise<void> {
        const config = await this.configManagerService.getCurrentConfig();

        this.LOGGER.success(`Ollama 服务初始化完成，模型: ${config.ai.embedding.model}`);

        // 检查 Ollama 服务是否可用
        if (!(await this.embeddingService.isAvailable())) {
            this.LOGGER.error("Ollama 服务不可用，跳过当前任务");
            return;
        }

        // 获取时间范围内的所有 sessionId
        const sessionIds = [] as string[];

        for (const groupId of Object.keys(config.groupConfigs)) {
            sessionIds.push(
                ...(await this.imDbAccessService.getSessionIdsByGroupIdAndTimeRange(
                    groupId,
                    params.startTimeStamp,
                    params.endTimeStamp
                ))
            );
        }

        // 获取所有 digest 结果
        const digestResults = [] as AIDigestResult[];

        for (const sessionId of sessionIds) {
            digestResults.push(...(await this.agcDbAccessService.getAIDigestResultsBySessionId(sessionId)));
        }
        this.LOGGER.info(`共获取到 ${digestResults.length} 条摘要结果`);

        // 过滤出未生成嵌入的 topicId
        const allTopicIds = digestResults.map(r => r.topicId);
        const topicIdsWithoutEmbedding = this.vectorDBManagerService.filterWithoutEmbedding(allTopicIds);

        this.LOGGER.info(`其中 ${topicIdsWithoutEmbedding.length} 条需要生成嵌入向量`);
        if (topicIdsWithoutEmbedding.length === 0) {
            this.LOGGER.info("没有需要生成嵌入的话题，任务完成");
            return;
        }

        // 构建待处理的 digest 映射
        const digestMap = new Map<string, AIDigestResult>();

        for (const digest of digestResults) {
            digestMap.set(digest.topicId, digest);
        }

        // 开始处理。按批次处理
        const batchSize = config.ai.embedding.batchSize;

        for (let i = 0; i < topicIdsWithoutEmbedding.length; i += batchSize) {
            const currentBatchTopicIds = topicIdsWithoutEmbedding.slice(i, i + batchSize);

            this.LOGGER.info(
                `处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(topicIdsWithoutEmbedding.length / batchSize)}，当前批次共 ${currentBatchTopicIds.length} 条`
            );

            // 构建输入文本 && 进行数据清洗
            const texts = currentBatchTopicIds.map(topicId => {
                const digest = anonymizeDigestDetail(digestMap.get(topicId)!);

                return `${digest.topic} ${digest.detail}`;
            });

            this.LOGGER.success(`已构建&清洗 ${texts.length} 条输入文本，示例：${texts[0]}`);

            try {
                // 批量生成嵌入向量
                const embeddings = await this.embeddingService.embedBatch(texts);
                // 批量存储
                const items = currentBatchTopicIds.map((topicId, idx) => ({
                    topicId,
                    embedding: embeddings[idx]
                }));

                this.vectorDBManagerService.storeEmbeddings(items);

                this.LOGGER.success(`批次处理完成，已存储 ${items.length} 条向量`);
            } catch (error) {
                this.LOGGER.error(`批次处理失败: ${error}，继续处理下一批次`);
            }
        }

        this.LOGGER.success(
            `🥳任务完成：向量数据库当前共 ${this.vectorDBManagerService.getCount()} 条记录`
        );
    }
}
