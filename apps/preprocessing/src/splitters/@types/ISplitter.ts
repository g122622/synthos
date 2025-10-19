import { IMDBManager } from "@root/common/database/IMDBManager";
import { ProcessedChatMessageWithRawMessage } from "@root/common/types/data-provider";

/**
 * 消息分割器接口。
 * 分割器的实现不应该考虑provider的实现细节。
 * 与provider不同，splitter既可以是无状态的，也可以是有状态的（比如用kv引擎持久化数据）。
 */
export interface ISplitter {
    init(): Promise<void>;
    /**
     * 为指定的群内的未分配消息分配会话ID。
     * @param imdbManager IM数据库管理器实例（必须已经初始化过）。
     * @param groupId 要分配会话ID的群ID。
     * @param minutesAgo 时间窗口，指的是要分配从当前时间往前多少分钟的消息。
     */
    assignSessionId(imdbManager: IMDBManager, groupId: string, minutesAgo: number): Promise<ProcessedChatMessageWithRawMessage[]>;
    close(): Promise<void>;
}
