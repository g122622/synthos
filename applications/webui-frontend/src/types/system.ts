/**
 * 系统监控相关的类型定义
 */

/**
 * 系统统计数据
 */
export interface SystemStats {
    timestamp: number;
    storage: {
        chatRecordDB: { count: number; size: number };
        imMessageFtsDB: { count: number; size: number };
        aiDialogueDB: { count: number; size: number };
        vectorDB: { count: number; size: number };
        kvStoreBackend: { count: number; size: number };
        kvStorePersistent: { count: number; size: number };
        logs: { count: number; size: number };
        totalSize: number;
    };
    modules: Record<string, { cpu: number; memory: number }>;
}
