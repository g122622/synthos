export interface RawChatMessage {
    msgId: string;
    messageContent: string;
    groupId: string;
    timestamp: number; // 消息发送时间戳, 单位: 毫秒
    senderId: string; // 消息发送者id
    quotedMsgId?: string; // 引用的消息
}

export interface ProcessedChunk {
    sessionId: string;
    content: string;
    embedding?: number[];
}
