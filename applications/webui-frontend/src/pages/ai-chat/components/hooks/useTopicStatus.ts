import { useCallback, useState } from "react";

import { getTopicsFavoriteStatus, getTopicsReadStatus } from "@/api/readAndFavApi";

/**
 * 话题收藏/已读状态管理
 */
export function useTopicStatus() {
    const [favoriteTopics, setFavoriteTopics] = useState<Record<string, boolean>>({});
    const [readTopics, setReadTopics] = useState<Record<string, boolean>>({});

    const loadTopicStatuses = useCallback(async (topicIds: string[]) => {
        if (topicIds.length === 0) {
            return;
        }

        try {
            const [favoriteRes, readRes] = await Promise.all([getTopicsFavoriteStatus(topicIds), getTopicsReadStatus(topicIds)]);

            if (favoriteRes.success && favoriteRes.data) {
                setFavoriteTopics(prev => ({ ...prev, ...favoriteRes.data }));
            }
            if (readRes.success && readRes.data) {
                setReadTopics(prev => ({ ...prev, ...readRes.data }));
            }
        } catch (err) {
            console.error("获取话题状态失败:", err);
        }
    }, []);

    const toggleFavorite = useCallback((topicId: string) => {
        setFavoriteTopics(prev => ({
            ...prev,
            [topicId]: !prev[topicId]
        }));
    }, []);

    const markAsRead = useCallback((topicId: string) => {
        setReadTopics(prev => ({
            ...prev,
            [topicId]: true
        }));
    }, []);

    return { favoriteTopics, readTopics, loadTopicStatuses, toggleFavorite, markAsRead };
}
