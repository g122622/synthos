import { useCallback, useState } from "react";

import { getTopicsFavoriteStatus, getTopicsReadStatus, markTopicAsFavorite, markTopicAsRead, removeTopicFromFavorites } from "@/api/readAndFavApi";
import { Notification } from "@/util/Notification";

/**
 * reports 页面复用的话题收藏/已读状态管理
 */
export function useTopicStatus() {
    const [favoriteTopics, setFavoriteTopics] = useState<Record<string, boolean>>({});
    const [readTopics, setReadTopics] = useState<Record<string, boolean>>({});

    const loadStatuses = useCallback(async (topicIds: string[]) => {
        if (topicIds.length === 0) {
            return;
        }

        try {
            const [favoriteRes, readRes] = await Promise.all([getTopicsFavoriteStatus(topicIds), getTopicsReadStatus(topicIds)]);

            if (favoriteRes?.success && favoriteRes.data?.favoriteStatus) {
                setFavoriteTopics(prev => ({
                    ...prev,
                    ...favoriteRes.data.favoriteStatus
                }));
            }

            if (readRes?.success && readRes.data?.readStatus) {
                setReadTopics(prev => ({
                    ...prev,
                    ...readRes.data.readStatus
                }));
            }
        } catch (error) {
            console.error("初始化话题状态失败:", error);
        }
    }, []);

    const onMarkAsRead = useCallback(async (topicId: string) => {
        try {
            setReadTopics(prev => ({
                ...prev,
                [topicId]: true
            }));

            await markTopicAsRead(topicId);

            Notification.success({
                title: "标记成功",
                description: "话题已标记为已读"
            });
        } catch (error) {
            console.error("标记话题已读失败:", error);
            setReadTopics(prev => ({
                ...prev,
                [topicId]: false
            }));
            Notification.error({
                title: "标记失败",
                description: "无法标记话题为已读"
            });
        }
    }, []);

    const onToggleFavorite = useCallback(
        async (topicId: string) => {
            const isCurrentlyFavorite = favoriteTopics[topicId];

            try {
                setFavoriteTopics(prev => ({
                    ...prev,
                    [topicId]: !isCurrentlyFavorite
                }));

                if (isCurrentlyFavorite) {
                    await removeTopicFromFavorites(topicId);
                    Notification.success({
                        title: "取消收藏",
                        description: "话题已从收藏中移除"
                    });
                } else {
                    await markTopicAsFavorite(topicId);
                    Notification.success({
                        title: "收藏成功",
                        description: "话题已添加到收藏"
                    });
                }
            } catch (error) {
                console.error("更新收藏状态失败:", error);

                setFavoriteTopics(prev => ({
                    ...prev,
                    [topicId]: isCurrentlyFavorite
                }));

                Notification.error({
                    title: "操作失败",
                    description: "无法更新收藏状态"
                });
            }
        },
        [favoriteTopics]
    );

    return {
        favoriteTopics,
        readTopics,
        loadStatuses,
        onMarkAsRead,
        onToggleFavorite
    };
}
