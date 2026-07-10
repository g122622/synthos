/**
 * 话题相关的类型定义
 */

/**
 * AI摘要结果（基础字段）
 */
export interface AIDigestResult {
    topicId: string;
    sessionId: string;
    topic: string;
    contributors: string;
    detail: string;
    modelName: string;
    updateTime: number; // UNIX毫秒级时间戳
    hasEmbedding: boolean;
    contributorIDs?: string; // 与 contributors 昵称数组一一对应的 QQ 号数组，JSON 字符串；存量数据或暂未计算时为 undefined
}

/**
 * 话题项（包含时间范围和群组信息）
 */
export interface TopicItem extends AIDigestResult {
    timeStart: number;
    timeEnd: number;
    groupId: string;
}
