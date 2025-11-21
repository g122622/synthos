import API_BASE_URL from "./constants/baseUrl";

import fetchWrapper from "@/util/fetchWrapper";

// 健康检查接口
export const healthCheck = async (): Promise<ApiResponse<{ message: string; timestamp: string }>> => {
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
    const params = new URLSearchParams({
        groupId,
        timeStart: timeStart.toString(),
        timeEnd: timeEnd.toString()
    });

    const response = await fetchWrapper(`${API_BASE_URL}/api/chat-messages-by-group-id?${params}`);

    return response.json();
};

export const getSessionIdsByGroupIdsAndTimeRange = async (groupIds: string[], timeStart: number, timeEnd: number): Promise<ApiResponse<{ groupId: string; sessionIds: string[] }[]>> => {
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
}

interface AIDigestResultResponse extends AIDigestResult {}

interface AIDigestResultsResponse extends Array<AIDigestResult> {}

export const getAIDigestResultByTopicId = async (topicId: string): Promise<ApiResponse<AIDigestResultResponse>> => {
    const params = new URLSearchParams({ topicId });
    const response = await fetchWrapper(`${API_BASE_URL}/api/ai-digest-result-by-topic-id?${params}`);

    return response.json();
};

export const getAIDigestResultsBySessionIds = async (sessionIds: string[]): Promise<ApiResponse<{ sessionId: string; result: AIDigestResultsResponse }[]>> => {
    // 请求参数过大，使用post请求
    const response = await fetchWrapper(`${API_BASE_URL}/api/ai-digest-results-by-session-ids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionIds })
    });

    return response.json();
};

export const getAIDigestResultsBySessionId = async (sessionId: string): Promise<ApiResponse<AIDigestResultsResponse>> => {
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
