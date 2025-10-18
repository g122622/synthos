import { IMDBManager } from "@root/common/database/IMDBManager";
import { ProcessedChatMessageWithRawMessage } from "@root/common/types/data-provider";

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
