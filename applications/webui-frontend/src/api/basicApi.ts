import API_BASE_URL from "./constants/baseUrl";

import fetchWrapper from "@/util/fetchWrapper";
import { MOCK_ENABLED, mockConfig } from "@/config/mock";
import { mockGetGroupDetails, mockGetChatMessagesByGroupId, mockGetMessageHourlyStats, mockChatMessagesFtsSearch, mockGetChatMessagesFtsContext } from "@/mock/groupsMock";
import {
    mockGetSessionIdsByGroupIdsAndTimeRange,
    mockGetSessionTimeDurations,
    mockGetAIDigestResultByTopicId,
    mockGetAIDigestResultsBySessionId,
    mockGetAIDigestResultsBySessionIds
} from "@/mock/latestTopicsMock";

// 健康检查接口
export const healthCheck = async (): Promise<ApiResponse<{ message: string; timestamp: string }>> => {
    if (MOCK_ENABLED) {
        return {
            success: true,
            data: { message: "ok", timestamp: new Date().toISOString() },
            message: ""
        };
    }

    const response = await fetchWrapper(`${API_BASE_URL}/health`);

    return response.json();
};

// 群组相关接口
interface GroupDetail {
    IM: string;
    splitStrategy: string;
    groupIntroduction: string;
    aiModel: string;
}

interface GroupDetailsResponse {
    [groupId: string]: GroupDetail;
}

export const getGroupDetails = async (): Promise<ApiResponse<GroupDetailsResponse>> => {
    // 使用 mock 数据
    if (mockConfig.groups) {
        return mockGetGroupDetails();
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/group-details`);

    return response.json();
};

// 聊天消息相关接口
interface ChatMessage {
    msgId: string;
    messageContent: string;
    groupId: string;
    timestamp: number;
    senderId: string;
    senderGroupNickname: string;
    senderNickname: string;
    quotedMsgId: string;
    sessionId: string;
    preProcessedContent: string;
}

interface ChatMessagesResponse extends Array<ChatMessage> {}

export const getChatMessagesByGroupId = async (groupId: string, timeStart: number, timeEnd: number): Promise<ApiResponse<ChatMessagesResponse>> => {
    // 使用 mock 数据
    if (mockConfig.groups) {
        return mockGetChatMessagesByGroupId(groupId, timeStart, timeEnd);
    }

    const params = new URLSearchParams({
        groupId,
        timeStart: timeStart.toString(),
        timeEnd: timeEnd.toString()
    });

    const response = await fetchWrapper(`${API_BASE_URL}/api/chat-messages-by-group-id?${params}`);

    return response.json();
};

// ==================== Chat Messages FTS ====================

export const chatMessagesFtsSearch = async (params: {
    query: string;
    groupIds?: string[];
    timeStart?: number;
    timeEnd?: number;
    page: number;
    pageSize: number;
}): Promise<
    ApiResponse<{
        total: number;
        page: number;
        pageSize: number;
        groups: Array<{ groupId: string; count: number; hits: Array<{ msgId: string; timestamp: number; snippet: string }> }>;
    }>
> => {
    if (mockConfig.groups) {
        return mockChatMessagesFtsSearch(params);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/chat-messages-fts-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params)
    });

    return response.json();
};

export const getChatMessagesFtsContext = async (params: { groupId: string; msgId: string; before: number; after: number }): Promise<ApiResponse<ChatMessagesResponse>> => {
    if (mockConfig.groups) {
        return mockGetChatMessagesFtsContext(params);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/chat-messages-fts-context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params)
    });

    return response.json();
};

// 消息每小时统计响应类型
interface MessageHourlyStatsResponse {
    data: Record<string, { current: number[]; previous: number[] }>;
    timestamps: { current: number[]; previous: number[] };
    totalCounts: { current: number; previous: number };
}

export const getMessageHourlyStats = async (groupIds: string[]): Promise<ApiResponse<MessageHourlyStatsResponse>> => {
    // 使用 mock 数据
    if (mockConfig.groups) {
        return mockGetMessageHourlyStats(groupIds);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/message-hourly-stats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupIds })
    });

    return response.json();
};

export const getSessionIdsByGroupIdsAndTimeRange = async (groupIds: string[], timeStart: number, timeEnd: number): Promise<ApiResponse<{ groupId: string; sessionIds: string[] }[]>> => {
    // 使用 mock 数据
    if (mockConfig.latestTopics) {
        return mockGetSessionIdsByGroupIdsAndTimeRange(groupIds, timeStart, timeEnd);
    }

    // 请求参数过大，使用post请求
    const response = await fetchWrapper(`${API_BASE_URL}/api/session-ids-by-group-ids-and-time-range`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            groupIds,
            timeStart,
            timeEnd
        })
    });

    return response.json();
};

export const getSessionTimeDurations = async (sessionIds: string[]): Promise<ApiResponse<{ sessionId: string; timeStart: number; timeEnd: number }[]>> => {
    // 使用 mock 数据
    if (mockConfig.latestTopics) {
        return mockGetSessionTimeDurations(sessionIds);
    }

    // 请求参数过大，使用post请求
    const response = await fetchWrapper(`${API_BASE_URL}/api/session-time-durations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionIds })
    });

    return response.json();
};

// AI摘要相关接口
interface AIDigestResult {
    topicId: string;
    sessionId: string;
    topic: string;
    contributors: string;
    detail: string;
    modelName: string; // 生成摘要所使用的AI模型名称
    updateTime: number; // 摘要更新时间，UNIX毫秒时间戳格式
}

interface AIDigestResultResponse extends AIDigestResult {}

interface AIDigestResultsResponse extends Array<AIDigestResult> {}

export const getAIDigestResultByTopicId = async (topicId: string): Promise<ApiResponse<AIDigestResultResponse>> => {
    // 使用 mock 数据
    if (mockConfig.latestTopics) {
        return mockGetAIDigestResultByTopicId(topicId);
    }

    const params = new URLSearchParams({ topicId });
    const response = await fetchWrapper(`${API_BASE_URL}/api/ai-digest-result-by-topic-id?${params}`);

    return response.json();
};

export const getAIDigestResultsBySessionIds = async (sessionIds: string[]): Promise<ApiResponse<{ sessionId: string; result: AIDigestResultsResponse }[]>> => {
    // 使用 mock 数据
    if (mockConfig.latestTopics) {
        return mockGetAIDigestResultsBySessionIds(sessionIds);
    }

    // 请求参数过大，使用post请求
    const response = await fetchWrapper(`${API_BASE_URL}/api/ai-digest-results-by-session-ids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionIds })
    });

    return response.json();
};

export const getAIDigestResultsBySessionId = async (sessionId: string): Promise<ApiResponse<AIDigestResultsResponse>> => {
    // 使用 mock 数据
    if (mockConfig.latestTopics) {
        return mockGetAIDigestResultsBySessionId(sessionId);
    }

    // 请求参数过大，使用post请求
    const response = await fetchWrapper(`${API_BASE_URL}/api/ai-digest-results-by-session-ids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionIds: [sessionId] })
    });

    return response.json();
};

export const isSessionSummarized = async (sessionId: string): Promise<ApiResponse<{ isSummarized: boolean }>> => {
    const params = new URLSearchParams({ sessionId });
    const response = await fetchWrapper(`${API_BASE_URL}/api/is-session-summarized?${params}`);

    return response.json();
};

// 其他接口
interface QQAvatarResponse {
    avatarBase64: string;
}

export const getQQAvatar = async (qqNumber: string): Promise<ApiResponse<QQAvatarResponse>> => {
    const params = new URLSearchParams({ qqNumber });
    const response = await fetchWrapper(`${API_BASE_URL}/api/qq-avatar?${params}`);

    return response.json();
};
