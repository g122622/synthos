import { RawChatMessage } from "@root/common/types/data-provider";

export interface ISplitter {
    init(): Promise<void>;
    /**
     * 分割消息
     * @param messages 要分割的消息列表。
     * @returns 分割后的消息 Map，key 为消息 ID，value 为消息对应的sessionId。
     */
    split(messages: RawChatMessage[]): Promise<Map<string, string>>;
    close(): Promise<void>;
}
