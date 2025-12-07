/**
 * 消息类型标识（用于区分消息内容类型）
 * 对应字段：uint32 messageType = 40011;
 * 注：此枚举用于解析部分客户端或服务端返回的 messageType 字段，值与 MsgElementType 不同，属另一套分类体系。
 */
export enum MsgType {
    /**
     * 无消息（消息损坏、已退出群聊且时间久远等）
     * messageType == 0
     */
    NO_MESSAGE = 0,

    /**
     * 消息空白（msgid存在但内容未加载或为空）
     * messageType == 1
     */
    EMPTY_MESSAGE = 1,

    /**
     * 文本消息
     * messageType == 2
     */
    TEXT = 2,

    /**
     * 群文件消息
     * messageType == 3
     */
    GROUP_FILE = 3,

    /**
     * （保留）未在当前聊天记录中观察到类型 4 的消息
     * messageType == 4
     */
    RESERVED_4 = 4,

    /**
     * 系统消息（灰字提示，如入群、退群、禁言等）
     * messageType == 5
     */
    SYSTEM_NOTICE = 5,

    /**
     * 语音消息（PTT）
     * messageType == 6
     */
    VOICE = 6,

    /**
     * 视频文件消息
     * messageType == 7
     */
    VIDEO = 7,

    /**
     * 合并转发消息（多条消息合并转发）
     * messageType == 8
     */
    FORWARD_MERGED = 8,

    /**
     * 回复类型消息（引用/回复他人消息）
     * messageType == 9
     */
    REPLY = 9,

    /**
     * 红包消息
     * messageType == 10
     */
    RED_PACKET = 10,

    /**
     * 应用消息（如小程序、第三方应用卡片等）
     * messageType == 11
     */
    APP_MESSAGE = 11
}
