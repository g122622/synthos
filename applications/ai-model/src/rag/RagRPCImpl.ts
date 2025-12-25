/**
 * RAG RPC 实现
 * 提供语义搜索和 RAG 问答能力
 */
import { RAGRPCImplementation, SearchOutput, AskOutput, TriggerReportGenerateOutput } from "@root/common/rpc/ai-model/index";
import { VectorDBManager } from "../embedding/VectorDBManager";
import { OllamaEmbeddingService } from "../embedding/OllamaEmbeddingService";
import { AGCDBManager } from "@root/common/database/AGCDBManager";
import { IMDBManager } from "@root/common/database/IMDBManager";
import { TextGenerator } from "../generators/text/TextGenerator";
import Logger from "@root/common/util/Logger";
import { RAGCtxBuilder } from "../context/ctxBuilders/RAGCtxBuilder";
import { getCurrentFormattedTime } from "@root/common/util/TimeUtils";
import { QueryRewriter } from "./QueryRewriter";
import { EmbeddingPromptStore } from "../context/prompts/EmbeddingPromptStore";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { TaskHandlerTypes, TaskParameters } from "@root/common/scheduler/@types/Tasks";
import { ReportType } from "@root/common/contracts/report";

export class RagRPCImpl implements RAGRPCImplementation {
    private LOGGER = Logger.withTag("RagRPCImpl");
    private queryRewriter: QueryRewriter;

    constructor(
        private vectorDB: VectorDBManager,
        private embeddingService: OllamaEmbeddingService,
        private agcDB: AGCDBManager,
        private imDB: IMDBManager,
        private textGenerator: TextGenerator,
        private defaultModelName: string,
        private ragCtxBuilder: RAGCtxBuilder
    ) {
        // 在构造函数中创建 QueryRewriter 实例
        this.queryRewriter = new QueryRewriter(textGenerator, defaultModelName);
    }

    /**
     * 语义搜索
     */
    public async search(input: { query: string; limit: number }): Promise<SearchOutput> {
        this.LOGGER.info(`收到搜索请求: "${input.query}", limit=${input.limit}`);

        // 1. 将查询转换为向量
        const queryEmbedding = await this.embeddingService.embed(
            EmbeddingPromptStore.getEmbeddingPromptForRAG(input.query)
        );
        this.LOGGER.debug(`查询向量生成完成，维度: ${queryEmbedding.length}`);

        // 2. 向量搜索
        const results = this.vectorDB.searchSimilar(queryEmbedding, [], input.limit);
        this.LOGGER.debug(`向量搜索完成，找到 ${results.length} 条结果`);

        // 3. 获取完整的话题信息
        const output: SearchOutput = [];
        for (const result of results) {
            const digest = await this.agcDB.getAIDigestResultByTopicId(result.topicId);
            if (digest) {
                output.push({
                    topicId: result.topicId,
                    topic: digest.topic,
                    detail: digest.detail,
                    distance: result.distance,
                    contributors: digest.contributors
                });
            }
        }

        this.LOGGER.success(`搜索完成，返回 ${output.length} 条结果`);
        return output;
    }

    /**
     * RAG 问答
     */
    public async ask(input: { question: string; topK: number }): Promise<AskOutput> {
        this.LOGGER.info(`收到问答请求: "${input.question}", topK=${input.topK}`);

        // 1. 使用 Multi-Query 扩展原始问题
        const expandedQueries = await this.queryRewriter.expandQuery(input.question);
        this.LOGGER.info(`Multi-Query 扩展完成，共 ${expandedQueries.length} 个查询`);

        // 2. 对每个扩展查询进行搜索
        const allResults: SearchOutput = [];
        for (const query of expandedQueries) {
            this.LOGGER.debug(`执行查询: "${query}"`);
            const results = await this.search({ query, limit: input.topK });
            allResults.push(...results);
        }
        this.LOGGER.info(`Multi-Query 搜索完成，共获取 ${allResults.length} 条原始结果`);

        // 3. 文档去重（基于 topicId）
        const deduplicatedResults = this.deduplicateResults(allResults);
        this.LOGGER.info(`文档去重完成，去重后剩余 ${deduplicatedResults.length} 条结果`);

        if (deduplicatedResults.length === 0) {
            this.LOGGER.warning("未找到相关话题");
            return {
                answer: "抱歉，没有找到与您问题相关的话题内容。",
                references: []
            };
        }

        // 4. 按相关性排序，取 topK 条（因为 multi-query+去重后的结果数量大概率也是超过 topK 的）
        const topResults = deduplicatedResults
            .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
            .slice(0, input.topK);

        // 5. 构建 RAG prompt
        const prompt = await this.ragCtxBuilder.buildCtx(
            input.question,
            topResults,
            getCurrentFormattedTime(),
            this.agcDB,
            this.imDB
        );
        this.LOGGER.success(`RAG prompt 构建完成，长度: ${prompt.length}`);

        // 6. 调用 LLM 生成回答
        const { content: answer } = await this.textGenerator.generateTextWithModelCandidates(
            [this.defaultModelName],
            prompt
        );
        this.LOGGER.success(`LLM 回答生成完成，长度: ${answer.length}`);

        // 7. 构建引用列表
        const references = topResults.map(r => ({
            topicId: r.topicId,
            topic: r.topic,
            relevance: Math.max(0, 1 - (r.distance ?? 1)) // 距离转相关性，确保非负
        }));

        return {
            answer,
            references
        };
    }

    /**
     * 触发生成日报
     * 通过 Agenda 调度一个即时任务来生成日报
     */
    public async triggerReportGenerate(input: {
        type: "half-daily" | "weekly" | "monthly";
        timeStart?: number;
        timeEnd?: number;
    }): Promise<TriggerReportGenerateOutput> {
        this.LOGGER.info(`收到手动触发日报生成请求: type=${input.type}`);

        try {
            // 计算时间范围
            const now = Date.now();
            let timeStart: number;
            let timeEnd: number;

            if (input.timeStart !== undefined && input.timeEnd !== undefined) {
                // 使用用户指定的时间范围
                timeStart = input.timeStart;
                timeEnd = input.timeEnd;
            } else {
                // 使用默认时间范围
                timeEnd = now;
                switch (input.type) {
                    case 'half-daily':
                        timeStart = now - 12 * 60 * 60 * 1000; // 过去 12 小时
                        break;
                    case 'weekly':
                        timeStart = now - 7 * 24 * 60 * 60 * 1000; // 过去 7 天
                        break;
                    case 'monthly':
                        timeStart = now - 30 * 24 * 60 * 60 * 1000; // 过去 30 天
                        break;
                }
            }

            this.LOGGER.info(`日报时间范围: ${new Date(timeStart).toISOString()} - ${new Date(timeEnd).toISOString()}`);

            // 调度即时任务
            const taskData: TaskParameters<TaskHandlerTypes.GenerateReport> = {
                reportType: input.type as ReportType,
                timeStart,
                timeEnd
            };

            await agendaInstance.now<TaskParameters<TaskHandlerTypes.GenerateReport>>(
                TaskHandlerTypes.GenerateReport,
                taskData
            );

            this.LOGGER.success(`日报生成任务已调度: ${input.type}`);

            return {
                success: true,
                message: `${input.type} 日报生成任务已提交，请稍后刷新查看结果`
            };
        } catch (error) {
            this.LOGGER.error(`触发日报生成失败: ${error}`);
            return {
                success: false,
                message: `触发失败: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * 文档去重
     * 基于 topicId 去重。去重逻辑：在topicId相同的情况下，保留距离最小（相关性最高）的结果
     */
    private deduplicateResults(results: SearchOutput): SearchOutput {
        const topicMap = new Map<string, SearchOutput[number]>();

        for (const result of results) {
            const topicId = result.topicId;
            // 跳过无效的 topicId（理论上不会发生，但满足 TS 严格模式）
            if (!topicId) {
                continue;
            }

            const existing = topicMap.get(topicId);
            if (!existing) {
                // 新的 topicId，直接加入
                topicMap.set(topicId, result);
            } else {
                // 已存在，保留距离更小的（相关性更高）
                const currentDistance = result.distance ?? Infinity;
                const existingDistance = existing.distance ?? Infinity;
                if (currentDistance < existingDistance) {
                    topicMap.set(topicId, result);
                }
            }
        }

        return Array.from(topicMap.values());
    }
}
