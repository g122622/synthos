/**
 * QueryRewriter
 * 查询重写器，用于将用户原始问题扩展为多个查询
 * 实现 Multi-Query 策略以提高 RAG 检索的召回率和多样性
 */
import Logger from "@root/common/util/Logger";
import { TextGeneratorService } from "../services/generators/text/TextGeneratorService";
import { RagPromptStore } from "../context/prompts/RagPromptStore";
import { sleep } from "@root/common/util/promisify/sleep";

export class QueryRewriter {
    private LOGGER = Logger.withTag("QueryRewriter");
    private TextGeneratorService: TextGeneratorService;
    private modelName: string;

    constructor(TextGeneratorService: TextGeneratorService, modelName: string) {
        this.TextGeneratorService = TextGeneratorService;
        this.modelName = modelName;
    }

    /**
     * 将用户原始问题扩展为多个查询
     * @param originalQuestion 用户原始问题
     * @returns 扩展后的查询数组（包含原始问题）
     */
    async expandQuery(originalQuestion: string): Promise<string[]> {
        const maxRetries = 2;
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    this.LOGGER.warning(`Multi-Query 生成重试中 (第 ${attempt} 次)...`);
                    await sleep(3000);
                }

                const expandedQueries = await this.doExpandQuery(originalQuestion);
                this.LOGGER.success(`Multi-Query 扩展成功，生成 ${expandedQueries.length} 个查询`);
                return expandedQueries;
            } catch (error) {
                lastError = error as Error;
                this.LOGGER.error(`Multi-Query 生成失败: ${lastError.message}`);
            }
        }

        // 所有重试都失败，抛出错误
        throw new Error(
            `Multi-Query 多次重试仍然失败，已重试 ${maxRetries} 次: ${lastError?.message}。放弃重试。`
        );
    }

    /**
     * 执行实际的查询扩展逻辑
     */
    private async doExpandQuery(originalQuestion: string): Promise<string[]> {
        // 1. 获取 Multi-Query prompt
        const prompt = (await RagPromptStore.getMultiQueryPrompt(originalQuestion)).serializeToString();

        // 2. 调用 LLM 生成扩展查询
        const { content: response } = await this.TextGeneratorService.generateTextWithModelCandidates(
            [this.modelName],
            prompt
        );

        // 3. 解析 JSON 响应
        const queries = this.parseMultiQueryResponse(response);

        // 4. 将原始问题加入查询列表（确保原始问题也被检索）
        const allQueries = [originalQuestion, ...queries];

        // 5. 去重（避免 LLM 生成与原始问题相同的查询）
        const uniqueQueries = [...new Set(allQueries)];

        this.LOGGER.debug(`扩展查询列表: ${JSON.stringify(uniqueQueries)}`);
        return uniqueQueries;
    }

    /**
     * 解析 LLM 返回的 Multi-Query 响应
     * 期望格式为 JSON 数组：["query1", "query2", "query3"]
     */
    private parseMultiQueryResponse(response: string): string[] {
        // 尝试提取 JSON 数组
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            throw new Error(`无法从响应中提取 JSON 数组: ${response.substring(0, 200)}`);
        }

        try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (!Array.isArray(parsed)) {
                throw new Error("解析结果不是数组");
            }

            // 过滤空字符串和非字符串元素
            const queries = parsed
                .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
                .map(q => q.trim());

            if (queries.length === 0) {
                throw new Error("解析后的查询数组为空");
            }

            return queries;
        } catch (error) {
            throw new Error(`JSON 解析失败: ${(error as Error).message}, 原始响应: ${response.substring(0, 200)}`);
        }
    }
}
