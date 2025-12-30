/**
 * API 路由配置
 */
import { Express } from "express";
import { container } from "tsyringe";
import { TOKENS } from "../di/tokens";
import { asyncHandler } from "../errors/errorHandler";

// Controllers
import { AIDigestController } from "../controllers/AIDigestController";
import { ChatMessageController } from "../controllers/ChatMessageController";
import { GroupConfigController } from "../controllers/GroupConfigController";
import { InterestScoreController } from "../controllers/InterestScoreController";
import { MiscController } from "../controllers/MiscController";
import { TopicStatusController } from "../controllers/TopicStatusController";
import { SearchController } from "../controllers/SearchController";
import { RagChatHistoryController } from "../controllers/RagChatHistoryController";
import { ReportController } from "../controllers/ReportController";

export const setupApiRoutes = (app: Express): void => {
    // 获取 controller 实例
    const aiDigestController = container.resolve<AIDigestController>(TOKENS.AIDigestController);
    const chatMessageController = container.resolve<ChatMessageController>(
        TOKENS.ChatMessageController
    );
    const groupConfigController = container.resolve<GroupConfigController>(
        TOKENS.GroupConfigController
    );
    const interestScoreController = container.resolve<InterestScoreController>(
        TOKENS.InterestScoreController
    );
    const miscController = container.resolve<MiscController>(TOKENS.MiscController);
    const topicStatusController = container.resolve<TopicStatusController>(
        TOKENS.TopicStatusController
    );
    const searchController = container.resolve<SearchController>(TOKENS.SearchController);
    const ragChatHistoryController = container.resolve<RagChatHistoryController>(
        TOKENS.RagChatHistoryController
    );
    const reportController = container.resolve<ReportController>(TOKENS.ReportController);

    // ==================== 群组 ====================
    // 获取所有群组详情
    app.get(
        "/api/group-details",
        asyncHandler((req, res) => groupConfigController.getAllGroupDetails(req, res))
    );

    // ==================== 聊天消息 ====================
    // 获取聊天消息
    app.get(
        "/api/chat-messages-by-group-id",
        asyncHandler((req, res) => chatMessageController.getChatMessagesByGroupId(req, res))
    );

    // 获取会话ID
    app.post(
        "/api/session-ids-by-group-ids-and-time-range",
        asyncHandler((req, res) =>
            chatMessageController.getSessionIdsByGroupIdsAndTimeRange(req, res)
        )
    );

    // 获取会话时间范围
    app.post(
        "/api/session-time-durations",
        asyncHandler((req, res) => chatMessageController.getSessionTimeDurations(req, res))
    );

    // 获取多个群组的每小时消息统计（包括当前24小时和前一天24小时）
    app.post(
        "/api/message-hourly-stats",
        asyncHandler((req, res) => chatMessageController.getMessageHourlyStats(req, res))
    );

    // ==================== AI 摘要 ====================
    // 获取AI摘要结果
    app.get(
        "/api/ai-digest-result-by-topic-id",
        asyncHandler((req, res) => aiDigestController.getAIDigestResultByTopicId(req, res))
    );

    app.post(
        "/api/ai-digest-results-by-session-ids",
        asyncHandler((req, res) => aiDigestController.getAIDigestResultsBySessionIds(req, res))
    );

    // 检查会话是否已摘要
    app.get(
        "/api/is-session-summarized",
        asyncHandler((req, res) => aiDigestController.checkSessionSummarized(req, res))
    );

    // ==================== 杂项 ====================
    // 获取QQ号码对应的头像
    app.get(
        "/api/qq-avatar",
        asyncHandler((req, res) => miscController.getQQAvatar(req, res))
    );

    // 健康检查
    app.get("/health", (req, res) => miscController.healthCheck(req, res));

    // ==================== 兴趣度评分 ====================
    // 获取兴趣度计算结果
    app.post(
        "/api/interest-score-results",
        asyncHandler((req, res) => interestScoreController.getInterestScoreResults(req, res))
    );

    // ==================== 话题状态 ====================
    // 话题收藏状态管理
    app.post(
        "/api/topic/favorite/mark",
        asyncHandler((req, res) => topicStatusController.markAsFavorite(req, res))
    );

    app.post(
        "/api/topic/favorite/remove",
        asyncHandler((req, res) => topicStatusController.removeFromFavorites(req, res))
    );

    app.post(
        "/api/topic/favorite/status",
        asyncHandler((req, res) => topicStatusController.checkFavoriteStatus(req, res))
    );

    // 话题已读状态管理
    app.post(
        "/api/topic/read/mark",
        asyncHandler((req, res) => topicStatusController.markAsRead(req, res))
    );

    app.post(
        "/api/topic/read/unmark",
        asyncHandler((req, res) => topicStatusController.markAsUnread(req, res))
    );

    app.post(
        "/api/topic/read/status",
        asyncHandler((req, res) => topicStatusController.checkReadStatus(req, res))
    );

    // ==================== 搜索和问答 ====================
    // 语义搜索
    app.post(
        "/api/search",
        asyncHandler((req, res) => searchController.search(req, res))
    );

    // RAG 问答
    app.post(
        "/api/ask",
        asyncHandler((req, res) => searchController.ask(req, res))
    );

    // ==================== RAG 聊天历史 ====================
    // 创建新会话
    app.post(
        "/api/rag/session/create",
        asyncHandler((req, res) => ragChatHistoryController.createSession(req, res))
    );

    // 获取会话列表
    app.post(
        "/api/rag/session/list",
        asyncHandler((req, res) => ragChatHistoryController.getSessionList(req, res))
    );

    // 获取会话详情
    app.post(
        "/api/rag/session/detail",
        asyncHandler((req, res) => ragChatHistoryController.getSessionDetail(req, res))
    );

    // 删除会话
    app.post(
        "/api/rag/session/delete",
        asyncHandler((req, res) => ragChatHistoryController.deleteSession(req, res))
    );

    // 更新会话标题
    app.post(
        "/api/rag/session/update-title",
        asyncHandler((req, res) => ragChatHistoryController.updateSessionTitle(req, res))
    );

    // 清空所有会话
    app.post(
        "/api/rag/session/clear-all",
        asyncHandler((req, res) => ragChatHistoryController.clearAllSessions(req, res))
    );

    // ==================== 日报 ====================
    // 获取单个日报详情
    app.get(
        "/api/report/:reportId",
        asyncHandler((req, res) => reportController.getReportById(req, res))
    );

    // 获取日报列表（分页）
    app.post(
        "/api/reports",
        asyncHandler((req, res) => reportController.getReportsPaginated(req, res))
    );

    // 获取指定日期的半日报
    app.post(
        "/api/reports/by-date",
        asyncHandler((req, res) => reportController.getReportsByDate(req, res))
    );

    // 获取指定时间范围内的日报
    app.post(
        "/api/reports/by-time-range",
        asyncHandler((req, res) => reportController.getReportsByTimeRange(req, res))
    );

    // 获取最近的日报
    app.post(
        "/api/reports/recent",
        asyncHandler((req, res) => reportController.getRecentReports(req, res))
    );

    // 手动触发生成日报
    app.post(
        "/api/reports/generate",
        asyncHandler((req, res) => reportController.triggerGenerate(req, res))
    );

    // 日报已读状态管理
    app.post(
        "/api/report/read/mark",
        asyncHandler((req, res) => reportController.markAsRead(req, res))
    );

    app.post(
        "/api/report/read/unmark",
        asyncHandler((req, res) => reportController.markAsUnread(req, res))
    );

    app.post(
        "/api/report/read/status",
        asyncHandler((req, res) => reportController.checkReadStatus(req, res))
    );
};
