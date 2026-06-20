import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { TaskHandlerTypes, TaskParameters } from "@root/common/scheduler/@types/Tasks";
import Logger from "@root/common/util/Logger";
import { AgcDbAccessService } from "@root/common/services/database/AgcDbAccessService";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import { COMMON_TOKENS } from "@root/common/di/tokens";

import { EmbeddingService } from "../services/embedding/EmbeddingService";
import { VectorDBManagerService } from "../services/embedding/VectorDBManagerService";
import { anonymizeDigestDetail } from "../utils/anonymizeDigestDetail";
import { AI_MODEL_TOKENS } from "../di/tokens";

/**
 * 向量嵌入生成任务处理器
 * 负责为 AI 摘要结果生成向量嵌入
 */
@injectable()
export class GenerateEmbeddingTaskHandler {
    private LOGGER = Logger.withTag("🤖 GenerateEmbeddingTask");
    private migrationBackfillDone = false;

    public constructor(
        @inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService,
        @inject(COMMON_TOKENS.AgcDbAccessService) private agcDbAccessService: AgcDbAccessService,
        @inject(AI_MODEL_TOKENS.VectorDBManagerService) private vectorDBManagerService: VectorDBManagerService,
        @inject(AI_MODEL_TOKENS.EmbeddingService) private embeddingService: EmbeddingService
    ) {}

    /**
     * 注册任务到 Agenda 调度器
     */
    public async register(): Promise<void> {
        let config = await this.configManagerService.getCurrentConfig();

        await agendaInstance
            .create(TaskHandlerTypes.GenerateEmbedding)
            .unique({ name: TaskHandlerTypes.GenerateEmbedding }, { insertOnly: true })
            .save();

        agendaInstance.define<TaskParameters<TaskHandlerTypes.GenerateEmbedding>>(
            TaskHandlerTypes.GenerateEmbedding,
            async job => {
                this.LOGGER.info(`😋开始处理任务: ${job.attrs.name}`);

                config = await this.configManagerService.getCurrentConfig(); // 刷新配置

                // 迁移回填：为 hasEmbedding 列添加前已存在的旧数据补齐标记
                await this.runMigrationBackfill();

                // 检查 Ollama 服务是否可用
                if (!(await this.embeddingService.isAvailable())) {
                    this.LOGGER.error("Ollama 服务不可用，跳过当前任务");

                    return;
                }

                this.LOGGER.success(`Ollama 服务初始化完成，模型: ${config.ai.embedding.model}`);

                // 直接查询所有 hasEmbedding = 0 的摘要结果，无需考虑群组和时间范围
                const digestResults = await this.agcDbAccessService.getAIDigestResultsWithoutEmbedding();

                this.LOGGER.info(`共获取到 ${digestResults.length} 条需要生成嵌入的摘要结果`);

                if (digestResults.length === 0) {
                    this.LOGGER.info("没有需要生成嵌入的话题，任务完成");

                    return;
                }

                // 开始处理。按批次处理
                const batchSize = config.ai.embedding.batchSize;

                for (let i = 0; i < digestResults.length; i += batchSize) {
                    await job.touch(); // 保证任务存活

                    const currentBatch = digestResults.slice(i, i + batchSize);

                    this.LOGGER.info(
                        `处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(digestResults.length / batchSize)}，当前批次共 ${currentBatch.length} 条`
                    );

                    // 构建输入文本 && 进行数据清洗
                    const texts = currentBatch.map(digest => {
                        const anonymized = anonymizeDigestDetail(digest);

                        return `${anonymized.topic} ${anonymized.detail}`;
                    });

                    this.LOGGER.success(`已构建&清洗 ${texts.length} 条输入文本，示例：${texts[0]}`);

                    try {
                        // 批量生成嵌入向量
                        const embeddings = await this.embeddingService.embedBatch(texts);
                        // 批量存储
                        const items = currentBatch.map((digest, idx) => ({
                            topicId: digest.topicId,
                            embedding: embeddings[idx]
                        }));

                        this.vectorDBManagerService.storeEmbeddings(items);

                        // 标记这些 topicId 为已生成嵌入向量
                        const topicIds = currentBatch.map(d => d.topicId);

                        await this.agcDbAccessService.markEmbeddingGenerated(topicIds);

                        this.LOGGER.success(`批次处理完成，已存储 ${items.length} 条向量并标记 hasEmbedding`);
                    } catch (error) {
                        this.LOGGER.error(`批次处理失败: ${error}，继续处理下一批次`);
                        // 继续处理下一批次，不中断整个任务
                    }
                }

                this.LOGGER.success(
                    `🥳任务完成: ${job.attrs.name}，向量数据库当前共 ${this.vectorDBManagerService.getCount()} 条记录`
                );
            },
            {
                concurrency: 1,
                priority: "high",
                lockLifetime: 10 * 60 * 1000 // 10分钟
            }
        );
    }

    /**
     * 迁移回填：检查所有 hasEmbedding = 0 的行，查询向量数据库确定哪些已有嵌入，标记为 hasEmbedding = 1
     * 仅在首次运行时执行，后续通过 migrationBackfillDone 标志跳过
     */
    private async runMigrationBackfill(): Promise<void> {
        if (this.migrationBackfillDone) return;
        this.migrationBackfillDone = true;

        this.LOGGER.info("开始执行 hasEmbedding 字段迁移回填...");

        // 获取所有 hasEmbedding = 0 的 topicId
        const unmarkedResults = await this.agcDbAccessService.getAIDigestResultsWithoutEmbedding();

        if (unmarkedResults.length === 0) {
            this.LOGGER.info("无需回填 hasEmbedding 字段");

            return;
        }

        const allTopicIds = unmarkedResults.map(r => r.topicId);

        // 分批检查向量数据库（SQLite 每次查询有 ~999 变量限制）
        const BATCH_SIZE = 500;
        const withEmbeddingIds: string[] = [];

        for (let i = 0; i < allTopicIds.length; i += BATCH_SIZE) {
            const batch = allTopicIds.slice(i, i + BATCH_SIZE);
            const withoutEmbedding = this.vectorDBManagerService.filterWithoutEmbedding(batch);
            const withoutSet = new Set(withoutEmbedding);

            withEmbeddingIds.push(...batch.filter(id => !withoutSet.has(id)));
        }

        if (withEmbeddingIds.length > 0) {
            await this.agcDbAccessService.markEmbeddingGenerated(withEmbeddingIds);
            this.LOGGER.info(
                `hasEmbedding 回填完成：${withEmbeddingIds.length}/${allTopicIds.length} 条记录已有嵌入向量`
            );
        } else {
            this.LOGGER.info(`hasEmbedding 回填完成：${allTopicIds.length} 条记录均无嵌入向量`);
        }
    }
}
