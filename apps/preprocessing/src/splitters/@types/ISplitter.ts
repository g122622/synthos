import { ProcessedChatMessageWithRawMessage } from "@root/common/types/data-provider";

export interface ISplitter {
    init(): Promise<void>;
    /**
     * 分割消息
     * @param messages 要分割的消息列表（这个函数会自动排序，因此入参可以不按照时间顺序排列）。除了要分割的消息外，还应该传入至少一条更早的消息，用于更好的分割消息。
     * @returns 分割后的消息 Map，key 为消息 ID，value 为消息对应的sessionId。
     */
    split(messages: ProcessedChatMessageWithRawMessage[]): Promise<Map<string, string>>;
    close(): Promise<void>;
}
