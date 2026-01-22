/**
 * 搜索服务
 * 封装对 RAG RPC 的调用
 */
import { injectable, inject } from "tsyringe";
import { TOKENS } from "../di/tokens";
import type { RAGClient } from "../rpc/aiModelClient";
import type { SearchOutput, AskOutput } from "@root/common/rpc/ai-model";
import Logger from "@root/common/util/Logger";
import { InternalError } from "../errors/AppError";

@injectable()
export class SearchService {
    private LOGGER = Logger.withTag("SearchService");

    constructor(@inject(TOKENS.RAGClient) private ragClient: RAGClient) {}

    /**
     * 语义搜索
     * @param query 搜索查询
     * @param limit 返回数量限制
     * @returns 搜索结果列表
     */
    async search(query: string, limit: number = 10): Promise<SearchOutput> {
        this.LOGGER.info(`执行语义搜索: "${query}", limit=${limit}`);

        try {
            const results = await this.ragClient.search.query({ query, limit });
            this.LOGGER.success(`搜索完成，返回 ${results.length} 条结果`);
            return results;
        } catch (error) {
            this.LOGGER.error(`搜索失败: ${error}`);
            throw error;
        }
    }

    /**
     * RAG 问答
     * @param question 用户问题
     * @param topK 检索话题数量
     * @param enableQueryRewriter 是否启用查询重写器
     * @returns AI 回答及引用来源
     */
    async ask(question: string, topK: number, enableQueryRewriter: boolean = true): Promise<AskOutput> {
        this.LOGGER.info(`执行 RAG 问答: "${question}", topK=${topK}, enableQueryRewriter=${enableQueryRewriter}`);

        try {
            const result = await this.ragClient.ask.query({
                question,
                topK,
                enableQueryRewriter
            } as any);
            if (!result.answer) {
                throw new InternalError("result.answer无效");
            }
            this.LOGGER.success(`问答完成，回答长度: ${result.answer.length}`);
            return result;
        } catch (error) {
            this.LOGGER.error(`问答失败: ${error}, ${error instanceof Error ? JSON.stringify(error) : ""}`);
            throw error;
        }
    }
}
