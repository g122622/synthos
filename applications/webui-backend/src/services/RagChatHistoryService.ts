/**
 * RAG 聊天历史服务
 * 处理 RAG 问答历史记录的业务逻辑
 */
import type { ReferenceItem } from "@root/common/rpc/ai-model/index";
import type {
    RagChatSession,
    CreateSessionServiceInput,
    SessionDetail,
    SessionListResponse
} from "../types/rag-session";

import { injectable, inject } from "tsyringe";
import getRandomHash from "@root/common/util/math/getRandomHash";
import Logger from "@root/common/util/Logger";

import { TOKENS } from "../di/tokens";
import { RagChatHistoryManager } from "../repositories/RagChatHistoryManager";

@injectable()
export class RagChatHistoryService {
    constructor(@inject(TOKENS.RagChatHistoryManager) private ragChatHistoryManager: RagChatHistoryManager) {}

    private LOGGER = Logger.withTag("RagChatHistoryService");

    /**
     * 创建新会话
     * 自动生成标题（使用问题的前30个字符）
     */
    async createSession(input: CreateSessionServiceInput): Promise<SessionDetail> {
        const id = getRandomHash(32);
        // 使用问题的前30个字符作为标题
        const baseTitle = input.question.length > 30 ? input.question.substring(0, 30) + "..." : input.question;
        const isFailed = !!input.isFailed;
        const title = isFailed ? `【失败】${baseTitle}` : baseTitle;

        const session = await this.ragChatHistoryManager.createSession({
            id,
            title,
            question: input.question,
            answer: input.answer,
            refs: JSON.stringify(input.references),
            topK: input.topK,
            enableQueryRewriter: input.enableQueryRewriter,
            isFailed,
            failReason: input.failReason || "",
            pinned: false
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
     * 切换会话的置顶状态
     */
    async toggleSessionPin(sessionId: string, pinned: boolean): Promise<boolean> {
        return this.ragChatHistoryManager.toggleSessionPin(sessionId, pinned);
    }

    /**
     * 转换数据库会话记录为前端可用格式
     */
    private transformSession(session: RagChatSession): SessionDetail {
        let references: ReferenceItem[] = [];

        try {
            references = JSON.parse(session.refs) as ReferenceItem[];
        } catch (e) {
            this.LOGGER.warning(`会话 ${session.id} 的引用项解析失败，将使用空数组。错误：${e}`);
            references = [];
        }

        return {
            isFailed: !!session.isFailed,
            failReason: session.failReason || "",
            id: session.id,
            title: session.title,
            question: session.question,
            answer: session.answer,
            references,
            topK: session.topK,
            enableQueryRewriter:
                (session as unknown as { enableQueryRewriter?: unknown }).enableQueryRewriter === 0 ? false : true,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt
        };
    }
}
