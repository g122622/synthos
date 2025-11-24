import { KVStore } from "@root/common/util/KVStore";

export class TopicReadStatusManager {
    private static instance: TopicReadStatusManager;
    private store: KVStore<boolean>;

    private constructor(dbPath: string) {
        this.store = new KVStore<boolean>(dbPath);
    }

    /**
     * 获取单例实例
     * @param dbPath 可选：数据库路径，默认为 './data/read_topics'
     */
    static getInstance(dbPath: string = "./data/read_topics"): TopicReadStatusManager {
        if (!TopicReadStatusManager.instance) {
            TopicReadStatusManager.instance = new TopicReadStatusManager(dbPath);
        }
        return TopicReadStatusManager.instance;
    }

    /**
     * 标记话题为已读
     */
    async markAsRead(topicId: string): Promise<void> {
        await this.store.put(topicId, true);
    }

    /**
     * （可选）清除已读状态 —— 通常不需要，因为“未记录”即视为未读
     * 但若业务需要显式重置，可保留此方法
     */
    async markAsUnread(topicId: string): Promise<void> {
        await this.store.del(topicId);
    }

    /**
     * 检查话题是否已读
     */
    async isTopicRead(topicId: string): Promise<boolean> {
        const value = await this.store.get(topicId);
        return value === true; // 仅当明确存入 true 时才视为已读
    }

    /**
     * 关闭数据库连接（如需要）
     */
    async close(): Promise<void> {
        await this.store.close();
    }
}

export default TopicReadStatusManager;
