/**
 * Web 搜索工具
 * 从互联网搜索信息（使用 duck-duck-scrape 实现）
 */
import { ToolDefinition, ToolExecutor } from "../contracts/index";
import { injectable } from "tsyringe";
import Logger from "@root/common/util/Logger";
import { search, SearchOptions, SafeSearchType, SearchResult } from "duck-duck-scrape";

/**
 * Web 搜索工具参数
 */
interface WebSearchParams {
    /** 搜索查询 */
    query: string;
    /** 返回结果数量 */
    limit?: number;
}

/**
 * Web 搜索工具（duck-duck-scrape 实现）
 */
@injectable()
export class WebSearchTool {
    private LOGGER = Logger.withTag("WebSearchTool");

    /**
     * 获取工具定义
     */
    public getDefinition(): ToolDefinition {
        return {
            type: "function",
            function: {
                name: "web_search",
                description:
                    "从互联网搜索信息。适用于查找聊天记录之外的实时信息、百科知识、新闻等。\n" +
                    "使用 DuckDuckGo 搜索引擎获取最新结果",
                parameters: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "搜索查询，描述要查找的信息"
                        },
                        limit: {
                            type: "number",
                            description: "返回结果数量限制，默认 5",
                            default: 5
                        }
                    },
                    required: ["query"]
                }
            }
        };
    }

    /**
     * 执行 Web 搜索（使用 duck-duck-scrape）
     */
    public getExecutor(): ToolExecutor<WebSearchParams> {
        return async (params: WebSearchParams) => {
            const { query, limit = 5 } = params;
            this.LOGGER.info(`执行 DuckDuckGo 搜索: query="${query}", limit=${limit}`);

            try {
                // 配置搜索选项
                const options: SearchOptions = {
                    safeSearch: SafeSearchType.MODERATE,
                    region: "wt-wt" // 全球
                };

                // 执行搜索
                const results = await search(query, options);

                // 处理无结果的情况
                if (results.noResults || !results.results || results.results.length === 0) {
                    this.LOGGER.warning(`未找到与 "${query}" 相关的搜索结果`);
                    return {
                        totalResults: 0,
                        results: [],
                        note: "未找到相关结果"
                    };
                }

                // 转换结果格式
                const formattedResults = results.results.slice(0, limit).map((result: SearchResult) => ({
                    title: result.title.replace(/&#x27;/g, "'").replace(/&amp;/g, "&"),
                    url: result.url.trim(),
                    snippet: result.description || result.title || `关于"${query}"的搜索结果`,
                    source: result.bang ? `${result.bang.title} (${result.bang.domain})` : "DuckDuckGo"
                }));

                this.LOGGER.info(`成功获取 ${formattedResults.length} 个搜索结果`);
                return {
                    totalResults: formattedResults.length,
                    results: formattedResults,
                    note: "使用 duck-duck-scrape 库获取的真实搜索结果"
                };
            } catch (error) {
                this.LOGGER.error(`DuckDuckGo 搜索失败:` + error);

                // 失败时返回友好的错误信息
                return {
                    totalResults: 0,
                    results: [],
                    error: error instanceof Error ? error.message : "未知错误",
                    note: "搜索服务暂时不可用，请稍后再试"
                };
            }
        };
    }
}
