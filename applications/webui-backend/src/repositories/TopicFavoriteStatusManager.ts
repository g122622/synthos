import { KVStore } from "@root/common/util/KVStore";

export class TopicFavoriteStatusManager {
    private static instance: TopicFavoriteStatusManager;
    private store: KVStore<boolean>;

    private constructor(dbPath: string) {
        this.store = new KVStore<boolean>(dbPath);
    }

    /**
     * 获取单例实例
     * @param dbPath 可选：数据库路径，默认为 './data/favorite_topics'
     */
    static getInstance(dbPath: string = "./data/favorite_topics"): TopicFavoriteStatusManager {
        if (!TopicFavoriteStatusManager.instance) {
            TopicFavoriteStatusManager.instance = new TopicFavoriteStatusManager(dbPath);
        }

        return TopicFavoriteStatusManager.instance;
    }

    /**
     * 标记话题为收藏
     */
    async markAsFavorite(topicId: string): Promise<void> {
        await this.store.put(topicId, true);
    }

    /**
     * 从收藏中移除话题
     */
    async removeFromFavorites(topicId: string): Promise<void> {
        // 可选择删除键，或设为 false。这里选择删除以节省空间（语义上“未收藏”即无记录）
        // 如果业务需要保留历史状态，则改为 put(false)
        await this.store.del(topicId);
    }

    /**
     * 检查话题是否被收藏
     */
    async isTopicFavorite(topicId: string): Promise<boolean> {
        const value = await this.store.get(topicId);

        return value === true; // 显式判断 true，避免 undefined 或 false 混淆
    }

    /**
     * 关闭底层数据库（应用退出时调用）
     */
    async close(): Promise<void> {
        await this.store.dispose();
    }
}

export default TopicFavoriteStatusManager;
