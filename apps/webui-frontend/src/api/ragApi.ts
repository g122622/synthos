import API_BASE_URL from "./constants/baseUrl";

import fetchWrapper from "@/util/fetchWrapper";
import { mockConfig } from "@/config/mock";
import { mockSearch, mockAsk } from "@/mock/ragMock";

// ==================== 类型定义 ====================

// 搜索结果项
export interface SearchResultItem {
    topicId: string;
    topic: string;
    detail: string;
    distance: number;
    contributors: string;
}

// 搜索响应
export type SearchResponse = SearchResultItem[];

// 引用项
export interface ReferenceItem {
    topicId: string;
    topic: string;
    relevance: number;
}

// 问答响应
export interface AskResponse {
    answer: string;
    references: ReferenceItem[];
}

// ==================== API 接口 ====================

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
 */
export const ask = async (question: string, topK: number = 5): Promise<ApiResponse<AskResponse>> => {
    // 如果启用了 mock，使用 mock 数据
    if (mockConfig.rag) {
        return mockAsk(question, topK);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, topK })
    });

    return response.json();
};
