import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { TaskHandlerTypes, TaskParameters } from "@root/common/scheduler/@types/Tasks";
import Logger from "@root/common/util/Logger";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import { AgcDbAccessService } from "@root/common/services/database/AgcDbAccessService";
import { AIDigestResult } from "@root/common/contracts/ai-model";
import { EmbeddingService } from "../services/embedding/EmbeddingService";
import { VectorDBManagerService } from "../services/embedding/VectorDBManagerService";
import { anonymizeDigestDetail } from "../utils/anonymizeDigestDetail";
import { AI_MODEL_TOKENS } from "../di/tokens";
import { COMMON_TOKENS } from "@root/common/di/tokens";

/**
 * 向量嵌入生成任务处理器
 * 负责为 AI 摘要结果生成向量嵌入
 */
@injectable()
export class GenerateEmbeddingTaskHandler {
    private LOGGER = Logger.withTag("🤖 [ai-model-root-script] [GenerateEmbeddingTask]");

    public constructor(
        @inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService,
        @inject(COMMON_TOKENS.ImDbAccessService) private imDbAccessService: ImDbAccessService,
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
                const attrs = job.attrs.data;
                config = await this.configManagerService.getCurrentConfig(); // 刷新配置

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
                            attrs.startTimeStamp,
                            attrs.endTimeStamp
                        ))
                    );
                }

                // 获取所有 digest 结果
                const digestResults = [] as AIDigestResult[];
                for (const sessionId of sessionIds) {
                    digestResults.push(
                        ...(await this.agcDbAccessService.getAIDigestResultsBySessionId(sessionId))
                    );
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
                    await job.touch(); // 保证任务存活

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
}
