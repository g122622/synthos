import { RawChatMessage } from "@root/common/types/data-provider";
import { ISplitter } from "./@types/ISplitter";
import getRandomHash from "@root/common/util/getRandomHash";

export class FixedSplitter implements ISplitter {
    private config = {
        // 分隔消息的时间间隔（秒）
        splitTimeDuration: 3600 * 3 // 3小时
    };

    public async init() {}

    /**
     * 分割消息
     * @param messages 要分割的消息列表。
     * @returns 分割后的消息 Map，key 为消息 ID，value 为消息对应的sessionId。
     */
    public async split(messages: RawChatMessage[]): Promise<Map<string, string>> {
        // 实现思路：将给定的messages按照固定时间间隔进行分割（以第一个消息的时间为基准），分割后，位于同一组内的消息共享一个相同的sessionId
        const result = new Map<string, string>();
        if (messages.length === 0) {
            return result;
        }

        const sortedMessages = messages.sort((a, b) => a.timestamp - b.timestamp); // 从早到晚排序消息
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
