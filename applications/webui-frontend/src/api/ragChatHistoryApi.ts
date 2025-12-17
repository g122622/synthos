/**
 * RAG 聊天历史 API 接口
 * 用于管理 RAG 问答历史记录
 */
import API_BASE_URL from "./constants/baseUrl";

import fetchWrapper from "@/util/fetchWrapper";
import { mockConfig } from "@/config/mock";
import { mockCreateSession, mockGetSessionList, mockGetSessionDetail, mockDeleteSession, mockUpdateSessionTitle, mockClearAllSessions } from "@/mock/ragChatHistoryMock";

// ==================== 类型定义 ====================

/**
 * 引用项
 */
export interface ReferenceItem {
    topicId: string;
    topic: string;
    relevance: number;
}

/**
 * 会话列表项
 */
export interface SessionListItem {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
}

/**
 * 会话详情
 */
export interface SessionDetail {
    id: string;
    title: string;
    question: string;
    answer: string;
    references: ReferenceItem[];
    topK: number;
    createdAt: number;
    updatedAt: number;
}

/**
 * 会话列表响应
 */
export interface SessionListResponse {
    sessions: SessionListItem[];
    total: number;
    hasMore: boolean;
}

// ==================== API 接口 ====================

/**
 * 创建新会话
 */
export const createSession = async (question: string, answer: string, references: ReferenceItem[], topK: number): Promise<ApiResponse<SessionDetail>> => {
    // 如果启用了 mock，使用 mock 数据
    if (mockConfig.rag) {
        return mockCreateSession(question, answer, references, topK);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/rag/session/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer, references, topK })
    });

    return response.json();
};

/**
 * 获取会话列表
 */
export const getSessionList = async (limit: number, offset: number): Promise<ApiResponse<SessionListResponse>> => {
    // 如果启用了 mock，使用 mock 数据
    if (mockConfig.rag) {
        return mockGetSessionList(limit, offset);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/rag/session/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit, offset })
    });

    return response.json();
};

/**
 * 获取会话详情
 */
export const getSessionDetail = async (sessionId: string): Promise<ApiResponse<SessionDetail>> => {
    // 如果启用了 mock，使用 mock 数据
    if (mockConfig.rag) {
        return mockGetSessionDetail(sessionId);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/rag/session/detail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
    });

    return response.json();
};

/**
 * 删除会话
 */
export const deleteSession = async (sessionId: string): Promise<ApiResponse<void>> => {
    // 如果启用了 mock，使用 mock 数据
    if (mockConfig.rag) {
        return mockDeleteSession(sessionId);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/rag/session/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
    });

    return response.json();
};

/**
 * 更新会话标题
 */
export const updateSessionTitle = async (sessionId: string, title: string): Promise<ApiResponse<void>> => {
    // 如果启用了 mock，使用 mock 数据
    if (mockConfig.rag) {
        return mockUpdateSessionTitle(sessionId, title);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/rag/session/update-title`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, title })
    });

    return response.json();
};

/**
 * 清空所有会话
 */
export const clearAllSessions = async (): Promise<ApiResponse<void>> => {
    // 如果启用了 mock，使用 mock 数据
    if (mockConfig.rag) {
        return mockClearAllSessions();
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/rag/session/clear-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
    });

    return response.json();
};
