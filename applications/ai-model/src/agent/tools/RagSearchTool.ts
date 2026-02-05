/**
 * RAG 搜索工具
 * 基于语义相似度搜索聊天记录中的相关话题
 */
import { injectable, inject } from "tsyringe";
import { AgcDbAccessService } from "@root/common/services/database/AgcDbAccessService";
import { COMMON_TOKENS } from "@root/common/di/tokens";
import Logger from "@root/common/util/Logger";

import { ToolDefinition, ToolExecutor } from "../contracts/tools";
import { VectorDBManagerService } from "../../services/embedding/VectorDBManagerService";
import { EmbeddingService } from "../../services/embedding/EmbeddingService";
import { AI_MODEL_TOKENS } from "../../di/tokens";
import { EmbeddingPromptStore } from "../../context/prompts/EmbeddingPromptStore";

/**
 * RAG 搜索工具参数
 */
interface RagSearchParams {
    /** 搜索查询 */
    query: string;
    /** 返回结果数量限制 */
    limit?: number;
}

/**
 * RAG 搜索工具
 */
@injectable()
export class RagSearchTool {
    private LOGGER = Logger.withTag("RagSearchTool");

    public constructor(
        @inject(AI_MODEL_TOKENS.VectorDBManagerService) private vectorDB: VectorDBManagerService,
        @inject(AI_MODEL_TOKENS.EmbeddingService) private embeddingService: EmbeddingService,
        @inject(COMMON_TOKENS.AgcDbAccessService) private agcDB: AgcDbAccessService
    ) {}

    /**
     * 获取工具定义
     */
    public getDefinition(): ToolDefinition {
        return {
            type: "function",
            function: {
                name: "rag_search",
                description:
                    "基于语义相似度搜索聊天记录中的相关话题。适用于查找与特定主题、关键词或问题相关的历史讨论内容。",
                parameters: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "搜索查询，描述要查找的话题或问题"
                        },
                        limit: {
                            type: "number",
                            description: "返回结果数量限制，默认 5，最大 20",
                            default: 5
                        }
                    },
                    required: ["query"]
                }
            }
        };
    }

    /**
     * 执行 RAG 搜索
     */
    public getExecutor(): ToolExecutor<RagSearchParams> {
        return async (params: RagSearchParams) => {
            const { query, limit = 5 } = params;
            const actualLimit = Math.min(limit, 20);

            this.LOGGER.info(`执行 RAG 搜索: query="${query}", limit=${actualLimit}`);

            try {
                // 1. 将查询转换为向量
                const queryEmbedding = await this.embeddingService.embed(
                    EmbeddingPromptStore.getEmbeddingPromptForRAG(query)
                );

                // 2. 向量搜索
                const results = this.vectorDB.searchSimilar(queryEmbedding, [], actualLimit);

                // 3. 获取完整的话题信息
                const topics = [];

                for (const result of results) {
                    const digest = await this.agcDB.getAIDigestResultByTopicId(result.topicId);

                    if (digest) {
                        topics.push({
                            topicId: result.topicId,
                            topic: digest.topic,
                            detail: digest.detail,
                            contributors: digest.contributors,
                            relevanceScore: (1 - result.distance).toFixed(4)
                        });
                    }
                }

                this.LOGGER.info(`RAG 搜索完成，找到 ${topics.length} 条相关话题`);

                return {
                    totalResults: topics.length,
                    topics
                };
            } catch (error) {
                this.LOGGER.error(`RAG 搜索失败: ${error}`);
                throw error;
            }
        };
    }
}
