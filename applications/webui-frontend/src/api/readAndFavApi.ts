import API_BASE_URL from "./constants/baseUrl";

import fetchWrapper from "@/util/fetchWrapper";

// 话题收藏状态管理接口

// 标记话题为收藏
export const markTopicAsFavorite = async (topicId: string) => {
    const response = await fetchWrapper(`${API_BASE_URL}/api/topic/favorite/mark`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ topicId })
    });

    return response.json();
};

// 从收藏中移除话题
export const removeTopicFromFavorites = async (topicId: string) => {
    const response = await fetchWrapper(`${API_BASE_URL}/api/topic/favorite/remove`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ topicId })
    });

    return response.json();
};

// 检查多个话题是否被收藏
export const getTopicsFavoriteStatus = async (topicIds: string[]) => {
    const response = await fetchWrapper(`${API_BASE_URL}/api/topic/favorite/status`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ topicIds })
    });

    return response.json();
};

// 话题已读状态管理接口

// 标记话题为已读
export const markTopicAsRead = async (topicId: string) => {
    const response = await fetchWrapper(`${API_BASE_URL}/api/topic/read/mark`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ topicId })
    });

    return response.json();
};

// 清除话题的已读状态
export const unmarkTopicAsRead = async (topicId: string) => {
    const response = await fetchWrapper(`${API_BASE_URL}/api/topic/read/unmark`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ topicId })
    });

    return response.json();
};

// 检查多个话题是否已读
export const getTopicsReadStatus = async (topicIds: string[]) => {
    const response = await fetchWrapper(`${API_BASE_URL}/api/topic/read/status`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ topicIds })
    });

    return response.json();
};
