/**
 * 话题参与者昵称 → QQ 号映射的纯计算工具
 *
 * 设计内涵：摘要生成阶段（AISummarize）内存里已持有该 session 的全部消息，
 * 可直接在内存中按昵称反查 senderId（QQ号），无需跨表 SQL。
 * 反查 SQL 的"昵称来源"与喂给 LLM 的预处理消息保持一致：
 * 优先 senderGroupNickname，回落 senderNickname（见 preprocessing/src/formatMsg.ts）。
 */

/** 参与者反查所需的最小消息字段 */
interface ResolvableMessage {
    /** 消息发送时间，UNIX 毫秒时间戳 */
    timestamp: number;
    /** 发送者 QQ 号 */
    senderId: string;
    /** 发送者群昵称 */
    senderGroupNickname: string;
    /** 发送者 QQ 昵称 */
    senderNickname: string;
}

/**
 * 根据昵称数组，从该 session 的消息中反查对应的 QQ 号数组
 *
 * 多对一处理：同一昵称可能匹配多个 senderId（撞昵称、改名、群昵称与 QQ 昵称重名等），
 * 此时取时间最早的那条消息的 senderId，最可能是本人。
 *
 * @param messages 该 session 内的全部消息（顺序无关，内部会按时间升序排序）
 * @param nicknames 参与者昵称数组，顺序即 contributors 数组顺序
 * @returns 与 nicknames 等长、顺序一一对应的 QQ 号数组；未命中该昵称的位置填空串 ""
 */
export function resolveContributorIds(messages: ResolvableMessage[], nicknames: string[]): string[] {
    if (nicknames.length === 0) {
        return [];
    }

    // 按时间升序排序，确保"取时间最早"语义稳定（不依赖入库顺序）
    const sortedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);

    return nicknames.map(nickname => {
        for (const msg of sortedMessages) {
            if (msg.senderGroupNickname === nickname || msg.senderNickname === nickname) {
                return msg.senderId;
            }
        }

        return "";
    });
}
