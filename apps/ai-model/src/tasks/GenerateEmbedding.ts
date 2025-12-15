import { agendaInstance } from "@root/common/scheduler/agenda";
import { TaskHandlerTypes, TaskParameters } from "@root/common/scheduler/@types/Tasks";
import Logger from "@root/common/util/Logger";
import { getConfigManagerService } from "@root/common/di/container";
import { IMDBManager } from "@root/common/database/IMDBManager";
import { AGCDBManager } from "@root/common/database/AGCDBManager";
import { AIDigestResult } from "@root/common/contracts/ai-model";
import { OllamaEmbeddingService } from "../embedding/OllamaEmbeddingService";
import { VectorDBManager } from "../embedding/VectorDBManager";
import { anonymizeDigestDetail } from "../utils/anonymizeDigestDetail";

export async function setupGenerateEmbeddingTask(
    imdbManager: IMDBManager,
    agcDBManager: AGCDBManager,
    vectorDBManager: VectorDBManager
) {
    const LOGGER = Logger.withTag("🤖 [ai-model-root-script] [GenerateEmbeddingTask]");
    const configManagerService = getConfigManagerService();
    let config = await configManagerService.getCurrentConfig(); // 初始化配置

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
            LOGGER.success(`Ollama 服务初始化完成，模型: ${config.ai.embedding.model}`);

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

            // 开始处理。按批次处理
            const batchSize = config.ai.embedding.batchSize;
            for (let i = 0; i < topicIdsWithoutEmbedding.length; i += batchSize) {
                await job.touch(); // 保证任务存活

                const currentBatchTopicIds = topicIdsWithoutEmbedding.slice(i, i + batchSize);
                LOGGER.info(
                    `处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(topicIdsWithoutEmbedding.length / batchSize)}，当前批次共 ${currentBatchTopicIds.length} 条`
                );

                // 构建输入文本 && 进行数据清洗
                const texts = currentBatchTopicIds.map(topicId => {
                    const digest = anonymizeDigestDetail(digestMap.get(topicId)!);
                    return `${digest.topic} ${digest.detail}`;
                });
                LOGGER.success(`已构建&清洗 ${texts.length} 条输入文本，示例：${texts[0]}`);

                try {
                    // 批量生成嵌入向量
                    const embeddings = await embeddingService.embedBatch(texts);

                    // 批量存储
                    const items = currentBatchTopicIds.map((topicId, idx) => ({
                        topicId,
                        embedding: embeddings[idx]
                    }));
                    vectorDBManager.storeEmbeddings(items);

                    LOGGER.success(`批次处理完成，已存储 ${items.length} 条向量`);
                } catch (error) {
                    LOGGER.error(`批次处理失败: ${error}，继续处理下一批次`);
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
}
