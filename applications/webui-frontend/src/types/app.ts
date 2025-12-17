// 应用相关的类型定义

// 群组详情
export interface GroupDetail {
    IM: string;
    splitStrategy: string;
    groupIntroduction: string;
    aiModel: string;
}

// 群组详情记录
export interface GroupDetailsRecord {
    [groupId: string]: GroupDetail;
}

// 聊天消息
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

// AI摘要结果
export interface AIDigestResult {
    topicId: string;
    sessionId: string;
    topic: string;
    contributors: string;
    detail: string;
}
