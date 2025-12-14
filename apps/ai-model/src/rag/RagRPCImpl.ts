/**
 * RAG RPC 实现
 * 提供语义搜索和 RAG 问答能力
 */
import { RAGRPCImplementation, SearchOutput, AskOutput } from "@root/common/rpc/ai-model";
import { VectorDBManager } from "../embedding/VectorDBManager";
import { OllamaEmbeddingService } from "../embedding/OllamaEmbeddingService";
import { AGCDBManager } from "@root/common/database/AGCDBManager";
import { IMDBManager } from "@root/common/database/IMDBManager";
import { TextGenerator } from "../generators/text/TextGenerator";
import Logger from "@root/common/util/Logger";
import { RAGCtxBuilder } from "../context/ctxBuilders/RAGCtxBuilder";
import { getCurrentFormattedTime, formatTimestamp } from "@root/common/util/TimeUtils";

export class RagRPCImpl implements RAGRPCImplementation {
    private LOGGER = Logger.withTag("RagRPCImpl");

    constructor(
        private vectorDB: VectorDBManager,
        private embeddingService: OllamaEmbeddingService,
        private agcDB: AGCDBManager,
        private imDB: IMDBManager,
        private textGenerator: TextGenerator,
        private defaultModelName: string,
        private ragCtxBuilder: RAGCtxBuilder
    ) {}

    /**
     * 语义搜索
     */
    async search(input: { query: string; limit: number }): Promise<SearchOutput> {
        this.LOGGER.info(`收到搜索请求: "${input.query}", limit=${input.limit}`);

        // 1. 将查询转换为向量
        const queryEmbedding = await this.embeddingService.embed(
            `为这个句子生成向量表示：${input.query}`
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
    async ask(input: { question: string; topK: number }): Promise<AskOutput> {
        this.LOGGER.info(`收到问答请求: "${input.question}", topK=${input.topK}`);

        // 1. 搜索相关话题
        const searchResults = await this.search({ query: input.question, limit: input.topK });
        if (searchResults.length === 0) {
            this.LOGGER.warning("未找到相关话题");
            return {
                answer: "抱歉，没有找到与您问题相关的话题内容。",
                references: []
            };
        }

        // 2. 构建 RAG prompt
        const prompt = await this.ragCtxBuilder.buildCtx(
            input.question,
            searchResults,
            getCurrentFormattedTime(),
            this.agcDB,
            this.imDB
        );

        this.LOGGER.debug(`RAG prompt 构建完成，长度: ${prompt.length}`);

        // 3. 调用 LLM 生成回答
        const answer = await this.textGenerator.generateTextWithCandidates(
            [this.defaultModelName],
            prompt
        );
        this.LOGGER.success(`LLM 回答生成完成，长度: ${answer.length}`);

        // 4. 构建引用列表
        const references = searchResults.map(r => ({
            topicId: r.topicId,
            topic: r.topic,
            relevance: Math.max(0, 1 - (r.distance ?? 0)) // 距离转相关性，确保非负
        }));

        return {
            answer,
            references
        };
    }
}
