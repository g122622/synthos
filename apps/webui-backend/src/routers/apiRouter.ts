import { Express } from "express";
import { WebUIServer } from "../index";

export const setupApiRoutes = (app: Express, server: WebUIServer): void => {
    // 获取所有群组详情
    app.get("/api/group-details", server.handleGetAllGroupDetails.bind(server));

    // 获取聊天消息
    app.get("/api/chat-messages-by-group-id", server.handleGetChatMessagesByGroupId.bind(server));

    // 获取AI摘要结果
    app.get(
        "/api/ai-digest-result-by-topic-id",
        server.handleGetAIDigestResultByTopicId.bind(server)
    );
    app.get(
        "/api/ai-digest-results-by-session-id",
        server.handleGetAIDigestResultsBySessionId.bind(server)
    );

    // 检查会话是否已摘要
    app.get("/api/is-session-summarized", server.handleCheckSessionSummarized.bind(server));

    // 获取QQ号码对应的头像
    app.get("/api/qq-avatar", server.handleGetQQAvatar.bind(server));

    // 健康检查
    app.get("/health", server.handleHealthCheck.bind(server));
};
