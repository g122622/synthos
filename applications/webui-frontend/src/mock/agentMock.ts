/**
 * Agent 模块模拟数据
 * 用于在只启动前端时展示 UI 效果
 */

import type { AgentAskRequest, AgentAskResponse, AgentConversation, AgentMessage } from "@/api/agentApi";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const createId = (prefix: string) => {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
};

const now = () => Date.now();

const mockConversations: AgentConversation[] = [];
const mockMessagesByConversationId: Record<string, AgentMessage[]> = {};

const ensureConversation = (conversationId: string, sessionId?: string): AgentConversation => {
    const exists = mockConversations.find(c => c.id === conversationId);

    if (exists) {
        return exists;
    }

    const createdAt = now();
    const conversation: AgentConversation = {
        id: conversationId,
        sessionId,
        title: "新的对话",
        createdAt,
        updatedAt: createdAt
    };

    mockConversations.unshift(conversation);
    mockMessagesByConversationId[conversationId] = [];

    return conversation;
};

const touchConversation = (conversationId: string) => {
    const idx = mockConversations.findIndex(c => c.id === conversationId);

    if (idx < 0) {
        return;
    }

    mockConversations[idx] = { ...mockConversations[idx], updatedAt: now() };

    // 保持列表按 updatedAt 倒序
    mockConversations.sort((a, b) => b.updatedAt - a.updatedAt);
};

const appendMessage = (message: AgentMessage) => {
    const list = mockMessagesByConversationId[message.conversationId] || [];

    list.push(message);
    list.sort((a, b) => a.timestamp - b.timestamp);

    mockMessagesByConversationId[message.conversationId] = list;
    touchConversation(message.conversationId);
};

const buildAssistantAnswer = (question: string): { content: string; toolsUsed: string[]; toolRounds: number } => {
    const q = question.toLowerCase();

    if (q.includes("rag") || q.includes("检索") || q.includes("搜索")) {
        return {
            content: "我将基于知识库先做一次检索，然后给出归纳后的答案。\n\n（Mock 模式下仅展示效果，不会真实调用后端工具。）",
            toolsUsed: ["rag_search"],
            toolRounds: 1
        };
    }

    if (q.includes("sql") || q.includes("数据库") || q.includes("查询")) {
        return {
            content: "我将把问题转成结构化查询，再把结果解释成可读结论。\n\n（Mock 模式下仅展示效果，不会真实查询数据库。）",
            toolsUsed: ["sql_query"],
            toolRounds: 1
        };
    }

    return {
        content: "这是 Agent 的 Mock 回复：\n\n- 我已收到你的问题\n- 我会按步骤思考并给出结论\n\n如需更真实的体验，请启动 webui-backend。",
        toolsUsed: [],
        toolRounds: 0
    };
};

/**
 * 模拟 Agent 问答
 */
export const mockAgentAsk = async (request: AgentAskRequest): Promise<ApiResponse<AgentAskResponse>> => {
    await delay(600 + Math.random() * 400);

    const conversationId = request.conversationId || createId("conv");

    ensureConversation(conversationId, request.sessionId);

    const userMessage: AgentMessage = {
        id: createId("msg_user"),
        conversationId,
        role: "user",
        content: request.question,
        timestamp: now()
    };

    appendMessage(userMessage);

    const answer = buildAssistantAnswer(request.question);

    const assistantMessageId = createId("msg_assistant");
    const tokenUsage = {
        promptTokens: Math.floor(100 + Math.random() * 200),
        completionTokens: Math.floor(200 + Math.random() * 400),
        totalTokens: 0
    };

    tokenUsage.totalTokens = tokenUsage.promptTokens + tokenUsage.completionTokens;

    const assistantMessage: AgentMessage = {
        id: assistantMessageId,
        conversationId,
        role: "assistant",
        content: answer.content,
        timestamp: now(),
        toolsUsed: answer.toolsUsed,
        toolRounds: answer.toolRounds,
        tokenUsage
    };

    appendMessage(assistantMessage);

    // 标题：用第一条问题做摘要
    const convIdx = mockConversations.findIndex(c => c.id === conversationId);

    if (convIdx >= 0) {
        const title = request.question.trim().slice(0, 20) || "新的对话";

        mockConversations[convIdx] = { ...mockConversations[convIdx], title };
        mockConversations.sort((a, b) => b.updatedAt - a.updatedAt);
    }

    return {
        success: true,
        data: {
            conversationId,
            messageId: assistantMessageId,
            content: assistantMessage.content,
            toolsUsed: answer.toolsUsed,
            toolRounds: answer.toolRounds,
            totalUsage: {
                promptTokens: tokenUsage.promptTokens,
                completionTokens: tokenUsage.completionTokens,
                totalTokens: tokenUsage.totalTokens
            }
        },
        message: ""
    };
};

/**
 * 模拟获取对话列表（按 updatedAt 倒序）
 */
export const mockGetAgentConversations = async (sessionId: string | undefined, beforeUpdatedAt: number | undefined, limit: number): Promise<ApiResponse<AgentConversation[]>> => {
    await delay(250 + Math.random() * 150);

    // 如果首次进入且没有数据，预置一些对话
    if (mockConversations.length === 0) {
        const seedSessionId = sessionId;

        for (let i = 0; i < 5; i++) {
            const id = createId("conv_seed");
            const createdAt = now() - (i + 1) * 60 * 60 * 1000;
            const conv: AgentConversation = {
                id,
                sessionId: seedSessionId,
                title: ["功能介绍", "使用说明", "问题排查", "方案对比", "最佳实践"][i] || "示例对话",
                createdAt,
                updatedAt: createdAt
            };

            mockConversations.push(conv);

            mockMessagesByConversationId[id] = [];
            appendMessage({
                id: createId("msg_user_seed"),
                conversationId: id,
                role: "user",
                content: "这是一个示例问题，用于展示聊天历史列表。",
                timestamp: createdAt + 1000
            });
            appendMessage({
                id: createId("msg_assistant_seed"),
                conversationId: id,
                role: "assistant",
                content: "这是一个示例回答（Mock）。",
                timestamp: createdAt + 2000
            });
        }

        mockConversations.sort((a, b) => b.updatedAt - a.updatedAt);
    }

    let list = mockConversations;

    if (sessionId) {
        list = list.filter(c => c.sessionId === sessionId);
    }

    if (beforeUpdatedAt !== undefined) {
        list = list.filter(c => c.updatedAt < beforeUpdatedAt);
    }

    list = [...list].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);

    return {
        success: true,
        data: list,
        message: ""
    };
};

/**
 * 模拟获取对话消息（返回时间升序，便于 UI 直接展示/追加）
 */
export const mockGetAgentMessages = async (conversationId: string, beforeTimestamp: number | undefined, limit: number): Promise<ApiResponse<AgentMessage[]>> => {
    await delay(250 + Math.random() * 150);

    ensureConversation(conversationId);

    const list = mockMessagesByConversationId[conversationId] || [];

    let candidates = list;

    if (beforeTimestamp !== undefined) {
        candidates = candidates.filter(m => m.timestamp < beforeTimestamp);
    }

    // 取最新 limit 条，但最终返回按时间升序
    const picked = [...candidates]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit)
        .sort((a, b) => a.timestamp - b.timestamp);

    return {
        success: true,
        data: picked,
        message: ""
    };
};
