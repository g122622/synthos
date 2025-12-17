/**
 * protobuf 消息元素类型（elementType / messageType）
 * 对应 proto 字段：uint32 messageType = 45002;
 */
export enum MsgElementType {
    /**
     * 文本消息
     * elementType == 1
     */
    TEXT = 1,

    /**
     * 图片消息
     * elementType == 2
     */
    IMAGE = 2,

    /**
     * 文件消息
     * elementType == 3
     */
    FILE = 3,

    /**
     * 语音消息（PTT）
     * elementType == 4
     */
    VOICE = 4,

    /**
     * 视频消息
     * elementType == 5
     */
    VIDEO = 5,

    /**
     * 表情消息（旧版表情）
     * elementType == 6
     */
    EMOJI = 6,

    /**
     * 引用/回复消息
     * elementType == 7
     */
    REPLY = 7,

    /**
     * 系统提示消息（如撤回、入群等）
     * elementType == 8
     */
    SYSTEM_NOTICE = 8,

    /**
     * 卡片消息（结构化消息，如小程序、富文本卡片）
     * elementType == 10
     */
    CARD = 10,

    /**
     * 表情消息（新版？或特殊表情）
     * elementType == 11
     */
    EMOJI_NEW = 11,

    /**
     * XML 消息（如公众号模板、服务通知）
     * elementType == 16
     */
    XML = 16,

    /**
     * 通话消息（语音/视频通话记录）
     * elementType == 21
     */
    CALL = 21,

    /**
     * 动态消息（如QQ看点、频道动态等）
     * elementType == 26
     */
    FEED = 26
}
