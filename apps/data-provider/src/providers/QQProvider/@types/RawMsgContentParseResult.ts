/**
 * 动态消息中的标题或内容结构
 */
interface FeedMessage {
    /** text = 48178 */
    text: string;
}

/**
 * 单条消息结构，对应 proto 中的 SingleMessage
 */
interface SingleMessage {
    // ========== 基础字段 ==========

    /** elementId，唯一标识 (messageId = 45001) */
    messageId: string;

    /** elementType (messageType = 45002) */
    messageType: number;

    // ========== 文本消息 (elementType == 1) ==========

    /** 文本内容 (messageText = 45101) */
    messageText: string;

    // ========== 语音消息 (elementType == 4) ==========

    /** 语音转文字 (pttText = 45923) */
    pttText: string;

    /** 语音持续时间（秒）(duration = 45906) */
    duration: number;

    /** 音频波形 (waveAmplitudes = 45925) —— 实际为 bytes，JS 中常转为 base64 或 Uint8Array */
    waveAmplitudes: string;

    // ========== 文件消息 (elementType == 3) ==========

    /** 文件名 (fileName = 45402) */
    fileName: string;

    /** 文件路径 (filePath = 45403) */
    filePath: string;

    /** 文件大小（字节）(fileSize = 45405) */
    fileSize: string;

    /** 文件 10MB 分片 MD5 (file10MMD5 = 45407) */
    file10MMD5: string;

    /** 文件 SHA1 (fileSha = 45408) */
    fileSha: string;

    /** 文件 SHA3 (fileSha3 = 45409) */
    fileSha3: string;

    /** 文件唯一标识 (fileUuid = 45503) */
    fileUuid: string;

    /** 预览图路径（文件类）(picThumbPath = 45954) */
    picThumbPath: string;

    /** 预览图大小（fileElement）(thumbSize = 95654) */
    thumbSize: number;

    // ========== 图片消息 (elementType == 2) ==========

    /** 图片类型：1000=静态图, 2000=GIF (picType = 45416) */
    picType: number;

    /** 图片宽度（像素）(picWidth = 45411) */
    picWidth: number;

    /** 图片高度（像素）(picHeight = 45412) */
    picHeight: number;

    /** 原图 MD5 (originImageMd5 = 45424) */
    originImageMd5: string;

    /** 低清图 URL (imageUrlLow = 45802) */
    imageUrlLow: string;

    /** 高清图 URL (imageUrlHigh = 45803) */
    imageUrlHigh: string;

    /** 原图 URL (imageUrlOrigin = 45804) */
    imageUrlOrigin: string;

    /** 图片 OCR 或描述文本 (imageText = 45815) */
    imageText: string;

    // ========== 视频消息 (elementType == 5) ==========

    /** 视频时长（秒）(videotime = 45410) */
    videotime: number;

    /** 封面宽度（像素）(thumbWidth = 45413) */
    thumbWidth: number;

    /** 封面高度（像素）(thumbHeight = 45414) */
    thumbHeight: number;

    /** 视频封面大小（字节）(thumbSizeVideo = 45415) */
    thumbSizeVideo: number;

    /** 封面文件名/路径 (thumbfilename = 45422) */
    thumbfilename: string;

    /** 封面 MD5 (thumbMD5 = 45862) */
    thumbMD5: string;

    // ========== 表情消息 (elementType == 6 或 11) ==========

    /** 表情 ID（faceindex）(emojiId = 47601) */
    emojiId: number;

    /** 表情文本（facetext）(emojiText = 47602) */
    emojiText: string;

    // ========== 引用/回复消息 (elementType == 7) ==========

    /** 被引用的消息 msgid (replyMsgId = 47401) */
    replyMsgId: string;

    /** 引用消息序列号 (replyMsgSeq = 47402) */
    replyMsgSeq: number;

    /** 引用消息时间戳（注意：表中 47403/47404 都是时间戳）(replyMsgTime = 47403) */
    replyMsgTime: number;

    /** 引用的文本内容 (replyMsgContent = 47413) */
    replyMsgContent: string;

    /** 引用方群昵称 (replySenderNick = 47421) */
    replySenderNick: string;

    /**
     * 嵌套的被引用消息（可选）
     * gy: sourceMsgIdInRecords = 47422 字段会引起解析错误，暂时不使用
     * (replyMessage = 47423)
     */
    replyMessage: SingleMessage | null;

    // ========== 卡片消息 (elementType == 10) ==========

    /** 卡片内容（通常为 JSON）(applicationMessage = 47901) */
    applicationMessage: string;

    // ========== XML 消息 (elementType == 16) ==========

    /** XML 内容 (xmlMessage = 48602) */
    xmlMessage: string;

    // ========== 系统提示消息 (elementType == 8) ==========

    /** 系统通知信息 (noticeInfo = 48214) */
    noticeInfo: string;

    /** 额外通知信息 (noticeInfo2 = 48271) */
    noticeInfo2: string;

    /** 撤回消息后缀 (withdrawSuffix = 47713) */
    withdrawSuffix: string;

    // ========== 动态消息 (elementType == 26) ==========

    /** 动态标题 (feedTitle = 48175) */
    feedTitle: FeedMessage | null;

    /** 动态内容 (feedContent = 48176) */
    feedContent: FeedMessage | null;

    /** 动态跳转链接 (feedUrl = 48180) */
    feedUrl: string;

    /** Logo 图标 URL (feedLogoUrl = 48181) */
    feedLogoUrl: string;

    /** 发布者 UID (feedPublisherUid = 48182) */
    feedPublisherUid: number;

    /** 跳转附加信息 (feedJumpInfo = 48183) */
    feedJumpInfo: string;

    /** 发布者 ID (feedPublisherId = 48188) */
    feedPublisherId: string;

    // ========== 通话消息 (elementType == 21) ==========

    /** 通话状态文本 (callStatusText = 48153) */
    callStatusText: string;

    /** 通话描述文本 (callText = 48157) */
    callText: string;

    // ========== 其他通用字段 ==========

    /** 发送者 ID (senderId = 40020) */
    senderId: string;

    /** 接收者 ID (receiverId = 40021) */
    receiverId: string;

    /**
     * 发送时间戳（秒）
     * 使用表中 49155 字段 (sendTimestamp = 49155)
     */
    sendTimestamp: number;

    /** 接收者 UID (receiverUid = 47411) */
    receiverUid: number;
}

/**
 * 消息容器，对应 proto 中的 Message
 * repeated SingleMessage messages = 40800;
 */
export interface RawMsgContentParseResult {
    messages: SingleMessage[];
}
