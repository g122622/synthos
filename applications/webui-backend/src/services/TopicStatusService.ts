/**
 * 话题状态服务（收藏、已读）
 */
import { injectable, inject } from "tsyringe";

import { TOKENS } from "../di/tokens";
import { TopicFavoriteStatusManager } from "../repositories/TopicFavoriteStatusManager";
import { TopicReadStatusManager } from "../repositories/TopicReadStatusManager";

@injectable()
export class TopicStatusService {
    constructor(
        @inject(TOKENS.TopicFavoriteStatusManager)
        private favoriteStatusManager: TopicFavoriteStatusManager,
        @inject(TOKENS.TopicReadStatusManager) private readStatusManager: TopicReadStatusManager
    ) {}

    // ==================== 收藏相关 ====================

    /**
     * 标记话题为收藏
     */
    async markAsFavorite(topicId: string): Promise<void> {
        await this.favoriteStatusManager.markAsFavorite(topicId);
    }

    /**
     * 从收藏中移除话题
     */
    async removeFromFavorites(topicId: string): Promise<void> {
        await this.favoriteStatusManager.removeFromFavorites(topicId);
    }

    /**
     * 批量检查话题收藏状态
     */
    async checkFavoriteStatus(topicIds: string[]): Promise<Record<string, boolean>> {
        const favoriteStatus: Record<string, boolean> = {};

        for (const topicId of topicIds) {
            favoriteStatus[topicId] = await this.favoriteStatusManager.isTopicFavorite(topicId);
        }

        return favoriteStatus;
    }

    // ==================== 已读相关 ====================

    /**
     * 标记话题为已读
     */
    async markAsRead(topicId: string): Promise<void> {
        await this.readStatusManager.markAsRead(topicId);
    }

    /**
     * 标记话题为未读
     */
    async markAsUnread(topicId: string): Promise<void> {
        await this.readStatusManager.markAsUnread(topicId);
    }

    /**
     * 批量检查话题已读状态
     */
    async checkReadStatus(topicIds: string[]): Promise<Record<string, boolean>> {
        const readStatus: Record<string, boolean> = {};

        for (const topicId of topicIds) {
            readStatus[topicId] = await this.readStatusManager.isTopicRead(topicId);
        }

        return readStatus;
    }
}
