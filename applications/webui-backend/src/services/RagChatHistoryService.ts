/**
 * RAG 聊天历史服务
 * 处理 RAG 问答历史记录的业务逻辑
 */
import { injectable, inject } from "tsyringe";
import getRandomHash from "@root/common/util/getRandomHash";
import { TOKENS } from "../di/tokens";
import {
    RagChatHistoryManager,
    RagChatSession,
    SessionListItem
} from "../repositories/RagChatHistoryManager";

/**
 * 引用项类型
 */
export interface ReferenceItem {
    topicId: string;
    topic: string;
    relevance: number;
}

/**
 * 创建会话的输入参数
 */
export interface CreateSessionServiceInput {
    question: string;
    answer: string;
    references: ReferenceItem[];
    topK: number;
}

/**
 * 会话详情（用于前端展示）
 */
export interface SessionDetail {
    id: string;
    title: string;
    question: string;
    answer: string;
    references: ReferenceItem[];
    topK: number;
    createdAt: number;
    updatedAt: number;
}

/**
 * 会话列表响应
 */
export interface SessionListResponse {
    sessions: SessionListItem[];
    total: number;
    hasMore: boolean;
}

@injectable()
export class RagChatHistoryService {
    constructor(
        @inject(TOKENS.RagChatHistoryManager) private ragChatHistoryManager: RagChatHistoryManager
    ) {}

    /**
     * 创建新会话
     * 自动生成标题（使用问题的前30个字符）
     */
    async createSession(input: CreateSessionServiceInput): Promise<SessionDetail> {
        const id = getRandomHash(32);
        // 使用问题的前30个字符作为标题
        const title =
            input.question.length > 30 ? input.question.substring(0, 30) + "..." : input.question;

        const session = await this.ragChatHistoryManager.createSession({
            id,
            title,
            question: input.question,
            answer: input.answer,
            references: JSON.stringify(input.references),
            topK: input.topK
        });

        return this.transformSession(session);
    }

    /**
     * 获取会话详情
     */
    async getSessionById(sessionId: string): Promise<SessionDetail | null> {
        const session = await this.ragChatHistoryManager.getSessionById(sessionId);
        if (!session) {
            return null;
        }
        return this.transformSession(session);
    }

    /**
     * 获取会话列表
     */
    async getSessionList(limit: number, offset: number): Promise<SessionListResponse> {
        const [sessions, total] = await Promise.all([
            this.ragChatHistoryManager.getSessionList(limit, offset),
            this.ragChatHistoryManager.getSessionCount()
        ]);

        return {
            sessions,
            total,
            hasMore: offset + sessions.length < total
        };
    }

    /**
     * 删除会话
     */
    async deleteSession(sessionId: string): Promise<boolean> {
        return this.ragChatHistoryManager.deleteSession(sessionId);
    }

    /**
     * 更新会话标题
     */
    async updateSessionTitle(sessionId: string, title: string): Promise<boolean> {
        return this.ragChatHistoryManager.updateSessionTitle(sessionId, title);
    }

    /**
     * 清空所有会话
     */
    async clearAllSessions(): Promise<void> {
        return this.ragChatHistoryManager.clearAllSessions();
    }

    /**
     * 转换数据库会话记录为前端可用格式
     */
    private transformSession(session: RagChatSession): SessionDetail {
        let references: ReferenceItem[] = [];
        try {
            references = JSON.parse(session.references);
        } catch {
            references = [];
        }

        return {
            id: session.id,
            title: session.title,
            question: session.question,
            answer: session.answer,
            references,
            topK: session.topK,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt
        };
    }
}
