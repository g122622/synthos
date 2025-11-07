import { RawChatMessage } from "@root/common/types/data-provider";

export function formatMsg(msg: RawChatMessage, quotedMsgId?: RawChatMessage): string {
    // 格式类似"'杨浩然(群昵称：ユリの花)'：【引用来自'李嘉浩(群昵称：DEAR James·Jordan ≈)'的消息: 今年offer发了多少】@DEAR James·Jordan ≈ 我觉得今年会超发offer"
    const nickname = msg.senderGroupNickname || msg.senderNickname;
    const content = msg.messageContent;
    if (quotedMsgId) {
        const quotedNickname = quotedMsgId.senderGroupNickname || quotedMsgId.senderNickname;
        const quotedContent = quotedMsgId.messageContent;
        return `【这条消息引用了来自"${quotedNickname}"的消息: ${quotedContent}】("${nickname}"): ${content}`;
    } else {
        return `("${nickname}"): ${content}`;
    }
}
