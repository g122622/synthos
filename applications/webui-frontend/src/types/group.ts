/**
 * 群组相关的类型定义
 */

/**
 * 群组详情
 */
export interface GroupDetail {
    IM: string;
    splitStrategy: string;
    groupIntroduction: string;
    aiModel: string;
}

/**
 * 群组详情记录
 */
export interface GroupDetailsRecord {
    [groupId: string]: GroupDetail;
}

/**
 * 群组列表项（包含消息统计）
 */
export interface GroupListItem {
    groupId: string;
    groupDetail: GroupDetail;
    messageCount: number;
    previousMessageCount: number;
}
