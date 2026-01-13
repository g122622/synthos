import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { ProcessedChatMessageWithRawMessage } from "@root/common/contracts/data-provider";
import { Disposable } from "@root/common/util/lifecycle/Disposable";

/**
 * 消息分割器接口。
 * 分割器的实现不应该考虑provider的实现细节。
 * 与provider不同，splitter既可以是无状态的，也可以是有状态的（比如用kv引擎持久化数据）。
 */
export interface ISplitter extends Disposable {
    init(): Promise<void>;
    /**
     * 为指定的群内的未分配消息分配会话ID。
     * @param imDbAccessService IM数据库管理器实例（必须已经初始化过）。
     * @param groupId 要分配会话ID的群ID。
     */
    assignSessionId(
        groupId: string,
        startTimeStamp: number,
        endTimeStamp: number
    ): Promise<ProcessedChatMessageWithRawMessage[]>;
}
