export interface RawChatMessage {
    msgID: string;
    messageContent: string;
    groupId: string;
    timestamp: number; // 消息发送时间戳, 单位: 毫秒
    senderID: string; // 消息发送者id
}

export interface ProcessedChunk {
    sessionId: string;
    content: string;
    embedding?: number[];
}
