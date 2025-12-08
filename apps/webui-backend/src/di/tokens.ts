/**
 * 依赖注入的 Token 定义
 */

export const TOKENS = {
    // DBManagers (作为 Repository 层)
    AGCDBManager: Symbol.for("AGCDBManager"),
    IMDBManager: Symbol.for("IMDBManager"),
    InterestScoreDBManager: Symbol.for("InterestScoreDBManager"),

    // Status Managers
    TopicFavoriteStatusManager: Symbol.for("TopicFavoriteStatusManager"),
    TopicReadStatusManager: Symbol.for("TopicReadStatusManager"),

    // Services
    AIDigestService: Symbol.for("AIDigestService"),
    ChatMessageService: Symbol.for("ChatMessageService"),
    GroupConfigService: Symbol.for("GroupConfigService"),
    InterestScoreService: Symbol.for("InterestScoreService"),
    MiscService: Symbol.for("MiscService"),
    TopicStatusService: Symbol.for("TopicStatusService"),

    // Controllers
    AIDigestController: Symbol.for("AIDigestController"),
    ChatMessageController: Symbol.for("ChatMessageController"),
    GroupConfigController: Symbol.for("GroupConfigController"),
    InterestScoreController: Symbol.for("InterestScoreController"),
    MiscController: Symbol.for("MiscController"),
    TopicStatusController: Symbol.for("TopicStatusController")
} as const;

