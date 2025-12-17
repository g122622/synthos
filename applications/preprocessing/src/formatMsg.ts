import { RawChatMessage } from "@root/common/contracts/data-provider";

// 优先使用quotedMsg；如果没有quotedMsg，使用quotedMsgContent；如果都没有，则不引用
export function formatMsg(msg: RawChatMessage, quotedMsg?: RawChatMessage, quotedMsgContent?: string): string {
    // 格式类似"'杨浩然(群昵称：ユリの花)'：【引用来自'李嘉浩(群昵称：DEAR James·Jordan ≈)'的消息: 今年offer发了多少】@DEAR James·Jordan ≈ 我觉得今年会超发offer"
    const nickname = msg.senderGroupNickname || msg.senderNickname;
    const content = msg.messageContent;
    if (quotedMsg) {
        const quotedNickname = quotedMsg.senderGroupNickname || quotedMsg.senderNickname;
        return `("${nickname}"):【这条消息引用了来自"${quotedNickname}"的消息: ${quotedMsg.messageContent}】 ${content}`;
    } else if (quotedMsgContent) {
        return `("${nickname}"):【这条消息引用了其他人的消息: ${quotedMsgContent}】 ${content}`;
    } else {
        return `("${nickname}"): ${content}`;
    }
}
