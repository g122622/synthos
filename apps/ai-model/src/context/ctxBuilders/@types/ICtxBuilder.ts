import { ProcessedChatMessageWithRawMessage } from "@root/common/types/data-provider";

export interface ICtxBuilder {
    init(): Promise<void>;
    /**
     * 依照给定的所有消息，构建一个上下文
     * @note 请务必确保这里的消息是按照时间顺序排序的，最新的消息在最后
     * @param messages 所有消息，按照时间顺序排序
     * @returns 可以直接注入大模型的上下文
     */
    buildCtx(messages: ProcessedChatMessageWithRawMessage[]): Promise<string>;
    close(): Promise<void>;
}
