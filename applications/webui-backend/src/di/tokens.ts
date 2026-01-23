/**
 * 依赖注入的 Token 定义
 */
import { COMMON_TOKENS } from "@root/common/di/tokens";

// 导出共享 Token
export { COMMON_TOKENS };

export const TOKENS = {
    // 引用共享的 ConfigManagerService Token
    ConfigManagerService: COMMON_TOKENS.ConfigManagerService,

    // DBManagers (作为 Repository 层) - 使用共享 Token
    AgcDbAccessService: COMMON_TOKENS.AgcDbAccessService,
    ImDbAccessService: COMMON_TOKENS.ImDbAccessService,
    ImDbFtsService: COMMON_TOKENS.ImDbFtsService,
    InterestScoreDbAccessService: COMMON_TOKENS.InterestScoreDbAccessService,
    ReportDbAccessService: COMMON_TOKENS.ReportDbAccessService,

    // Status Managers
    TopicFavoriteStatusManager: Symbol.for("TopicFavoriteStatusManager"),
    TopicReadStatusManager: Symbol.for("TopicReadStatusManager"),
    RagChatHistoryManager: Symbol.for("RagChatHistoryManager"),
    ReportReadStatusManager: Symbol.for("ReportReadStatusManager"),

    // RPC Clients
    RAGClient: Symbol.for("RAGClient"),

    // Services
    AIDigestService: Symbol.for("AIDigestService"),
    ChatMessageService: Symbol.for("ChatMessageService"),
    ChatMessageFtsService: Symbol.for("ChatMessageFtsService"),
    GroupConfigService: Symbol.for("GroupConfigService"),
    InterestScoreService: Symbol.for("InterestScoreService"),
    MiscService: Symbol.for("MiscService"),
    TopicStatusService: Symbol.for("TopicStatusService"),
    SearchService: Symbol.for("SearchService"),
    ConfigService: Symbol.for("ConfigService"),
    RagChatHistoryService: Symbol.for("RagChatHistoryService"),
    ReportService: Symbol.for("ReportService"),
    SystemMonitorService: Symbol.for("SystemMonitorService"),
    AgentService: Symbol.for("AgentService"),
    EmailService: COMMON_TOKENS.EmailService,

    // Controllers
    AIDigestController: Symbol.for("AIDigestController"),
    ChatMessageController: Symbol.for("ChatMessageController"),
    ChatMessageFtsController: Symbol.for("ChatMessageFtsController"),
    GroupConfigController: Symbol.for("GroupConfigController"),
    InterestScoreController: Symbol.for("InterestScoreController"),
    MiscController: Symbol.for("MiscController"),
    TopicStatusController: Symbol.for("TopicStatusController"),
    SearchController: Symbol.for("SearchController"),
    ConfigController: Symbol.for("ConfigController"),
    RagChatHistoryController: Symbol.for("RagChatHistoryController"),
    ReportController: Symbol.for("ReportController"),
    SystemMonitorController: Symbol.for("SystemMonitorController"),
    AgentController: Symbol.for("AgentController")
} as const;
