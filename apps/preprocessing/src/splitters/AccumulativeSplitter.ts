import { ProcessedChatMessageWithRawMessage } from "@root/common/types/data-provider";
import { ISplitter } from "./@types/ISplitter";
import getRandomHash from "@root/common/util/getRandomHash";
import ConfigManagerService from "@root/common/config/ConfigManagerService";
import { KVStore } from "@root/common/util/KVStore";

export class AccumulativeSplitter implements ISplitter {
    private kvStore: KVStore | null = null; // 用于存储 sessionId 的 KV 存储

    public async init() {
        const config = (await ConfigManagerService.getCurrentConfig()).preprocessors.AccumulativeSplitter;
        this.kvStore = new KVStore(config.persistentKVStorePath); // 初始化 KV 存储
    }

    public async split(messages: ProcessedChatMessageWithRawMessage[]): Promise<Map<string, string>> {
        const config = (await ConfigManagerService.getCurrentConfig()).preprocessors.AccumulativeSplitter;
        const sortedMessages = messages.sort((a, b) => a.timestamp - b.timestamp); // 从早到晚排序消息
        const result = new Map<string, string>();
        if (messages.length === 0) {
            return result;
        }

        const firstMessageTime = sortedMessages[0].timestamp;
        const splitTimeDuration = this.config.splitTimeDuration * 1000; // 转换为毫秒

        let currentSessionId = getRandomHash(16); // 初始 sessionId
        let currentGroupStartTime = firstMessageTime; // 当前组的起始时间
        for (let i = 0; i < sortedMessages.length; i++) {
            const msg = sortedMessages[i];
            if (msg.timestamp - currentGroupStartTime >= splitTimeDuration) {
                // 如果当前消息与当前组的起始时间超过了分割时间间隔，创建新的 sessionId
                currentSessionId = getRandomHash(16); // 生成新的 sessionId
                currentGroupStartTime = msg.timestamp; // 更新当前组的起始时间
            }
            result.set(msg.msgId, currentSessionId);
        }

        return result;
    }

    public async close() {}
}
