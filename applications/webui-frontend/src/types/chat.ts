/**
 * 聊天相关的类型定义
 */

/**
 * 聊天消息
 */
export interface ChatMessage {
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

/**
 * 全文搜索命中项
 */
export interface FtsHit {
    msgId: string;
    timestamp: number;
    snippet: string;
}

/**
 * 全文搜索群组结果
 */
export interface FtsGroup {
    groupId: string;
    count: number;
    hits: FtsHit[];
}

/**
 * 全文搜索结果
 */
export interface FtsResult {
    total: number;
    page: number;
    pageSize: number;
    groups: FtsGroup[];
}

/**
 * 每小时统计数据
 */
export interface MessageHourlyStatsData {
    data: Record<string, { current: number[]; previous: number[] }>;
    timestamps: { current: number[]; previous: number[] };
    totalCounts: { current: number; previous: number };
}
