export interface RawChatMessage {
    msgId: string;
    messageContent: string;
    groupId: string;
    timestamp: number; // 消息发送时间戳, 单位: 毫秒
    senderId: string; // 消息发送者id
    senderGroupNickname: string; // 消息发送者的群昵称
    senderNickname: string; // 消息发送者的昵称
    quotedMsgId?: string; // 引用的消息id
}

export interface ProcessedChatMessage {
    msgId: string;
    sessionId: string; // 消息所属会话id
    // 格式类似"'杨浩然(群昵称：ユリの花)'：【引用来自'李嘉浩(群昵称：DEAR James·Jordan ≈)'的消息: 今年offer发了多少】@DEAR James·Jordan ≈ 我觉得今年会超发offer"
    preProcessedContent?: string;
}

export type ProcessedChatMessageWithRawMessage = RawChatMessage & ProcessedChatMessage;

// IM类型
export enum IMTypes {
    QQ = "QQ",
    WeChat = "WeChat",
    Telegram = "Telegram",
    Discord = "Discord"
}
