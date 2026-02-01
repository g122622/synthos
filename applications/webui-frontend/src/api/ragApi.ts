import type { SearchResponse, AskResponse } from "@/types/rag";
import type { ApiResponse } from "@/types/api";

import API_BASE_URL from "./constants/baseUrl";

import fetchWrapper from "@/util/fetchWrapper";
import { mockConfig } from "@/config/mock";
import { mockSearch, mockAsk } from "@/mock/ragMock";

// 导出ReferenceItem、SearchResultItem、AskResponse供mock和组件使用
export type { ReferenceItem, SearchResultItem, AskResponse } from "@/types/rag";

// ==================== API 接口 ===================="

/**
 * 语义搜索
 * @param query 搜索查询
 * @param limit 返回结果数量限制
 */
export const search = async (query: string, limit: number = 10): Promise<ApiResponse<SearchResponse>> => {
    // 如果启用了 mock，使用 mock 数据
    if (mockConfig.rag) {
        return mockSearch(query, limit);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit })
    });

    return response.json();
};

/**
 * RAG 问答
 * @param question 问题
 * @param topK 参考话题数量
 * @param enableQueryRewriter 是否启用查询重写器
 */
export const ask = async (question: string, topK: number = 50, enableQueryRewriter: boolean = true): Promise<ApiResponse<AskResponse>> => {
    // 如果启用了 mock，使用 mock 数据
    if (mockConfig.rag) {
        return mockAsk(question, topK);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, topK, enableQueryRewriter })
    });

    return response.json();
};
