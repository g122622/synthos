import { KVStore } from "@root/common/util/KVStore";

/**
 * 日报已读状态管理器
 * 使用 KVStore（LevelDB）存储日报的已读状态
 */
export class ReportReadStatusManager {
    private static instance: ReportReadStatusManager;
    private store: KVStore<boolean>;

    private constructor(dbPath: string) {
        this.store = new KVStore<boolean>(dbPath);
    }

    /**
     * 获取单例实例
     * @param dbPath 可选：数据库路径，默认为 './data/read_reports'
     */
    public static getInstance(dbPath: string = "./data/read_reports"): ReportReadStatusManager {
        if (!ReportReadStatusManager.instance) {
            ReportReadStatusManager.instance = new ReportReadStatusManager(dbPath);
        }
        return ReportReadStatusManager.instance;
    }

    /**
     * 标记日报为已读
     */
    public async markAsRead(reportId: string): Promise<void> {
        await this.store.put(reportId, true);
    }

    /**
     * 清除日报的已读状态
     */
    public async markAsUnread(reportId: string): Promise<void> {
        await this.store.del(reportId);
    }

    /**
     * 检查日报是否已读
     */
    public async isReportRead(reportId: string): Promise<boolean> {
        const value = await this.store.get(reportId);
        return value === true; // 仅当明确存入 true 时才视为已读
    }

    /**
     * 关闭数据库连接
     */
    public async close(): Promise<void> {
        await this.store.dispose();
    }
}

export default ReportReadStatusManager;
