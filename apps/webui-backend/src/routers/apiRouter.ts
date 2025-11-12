import { Express } from "express";
import { WebUIServer } from "../index";

export const setupApiRoutes = (app: Express, server: WebUIServer): void => {
    // 获取所有群组详情
    app.get("/api/group-details", server.handleGetAllGroupDetails.bind(server));

    // 获取聊天消息
    app.get("/api/chat-messages-by-group-id", server.handleGetChatMessagesByGroupId.bind(server));

    // 获取会话ID
    app.post(
        "/api/session-ids-by-group-ids-and-time-range",
        server.handleGetSessionIdsByGroupIdsAndTimeRange.bind(server)
    );

    // 获取会话时间范围
    app.post(
        "/api/session-time-durations",
        server.handleGetSessionTimeDurations.bind(server)
    );

    // 获取AI摘要结果
    app.get(
        "/api/ai-digest-result-by-topic-id",
        server.handleGetAIDigestResultByTopicId.bind(server)
    );
    app.post(
        "/api/ai-digest-results-by-session-ids",
        server.handleGetAIDigestResultsBySessionIds.bind(server)
    );

    // 检查会话是否已摘要
    app.get("/api/is-session-summarized", server.handleCheckSessionSummarized.bind(server));

    // 获取QQ号码对应的头像
    app.get("/api/qq-avatar", server.handleGetQQAvatar.bind(server));

    // 健康检查
    app.get("/health", server.handleHealthCheck.bind(server));

    // 获取兴趣度计算结果
    app.post(
        "/api/interest-score-results",
        server.handleGetInterestScoreResults.bind(server)
    );
};
