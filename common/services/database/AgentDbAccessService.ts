/**
 * Agent 数据库访问服务
 * 负责 Agent 对话历史的存储和查询
 */
import "reflect-metadata";
import { injectable, container } from "tsyringe";

import Logger from "../../util/Logger";
import { Disposable } from "../../util/lifecycle/Disposable";
import { mustInitBeforeUse } from "../../util/lifecycle/mustInitBeforeUse";
import { COMMON_TOKENS } from "../../di/tokens";

import { CommonDBService } from "./infra/CommonDBService";
import { createAgentTableSQL } from "./constants/InitialSQL";

/**
 * Agent 对话记录
 */
export interface AgentConversation {
    /** 对话 ID */
    id: string;
    /** 会话 ID（关联到聊天会话） */
    sessionId?: string;
    /** 对话标题 */
    title: string;
    /** 创建时间（毫秒时间戳） */
    createdAt: number;
    /** 更新时间（毫秒时间戳） */
    updatedAt: number;
}

/**
 * Agent 消息记录
 */
export interface AgentMessage {
    /** 消息 ID */
    id: string;
    /** 对话 ID */
    conversationId: string;
    /** 消息角色 */
    role: "user" | "assistant" | "system";
    /** 消息内容 */
    content: string;
    /** 时间戳（毫秒时间戳） */
    timestamp: number;
    /** 使用的工具列表（JSON 数组字符串） */
    toolsUsed?: string;
    /** 工具调用轮数 */
    toolRounds?: number;
    /** Token 使用量（JSON 对象字符串） */
    tokenUsage?: string;
}

/**
 * Agent 数据库访问服务
 */
@injectable()
@mustInitBeforeUse
export class AgentDbAccessService extends Disposable {
    private LOGGER = Logger.withTag("AgentDbAccessService");
    private db: CommonDBService | null = null;

    /**
     * 初始化数据库服务
     */
    public async init(): Promise<void> {
        // 从 DI 容器获取 CommonDBService 实例
        this.db = container.resolve<CommonDBService>(COMMON_TOKENS.CommonDBService);
        await this.db.init(createAgentTableSQL);
    }

    /**
     * 创建新对话
     * @param id 对话 ID
     * @param title 对话标题
     * @param sessionId 会话 ID（可选）
     * @returns 对话记录
     */
    public async createConversation(id: string, title: string, sessionId?: string): Promise<AgentConversation> {
        const now = Date.now();
        const conversation: AgentConversation = {
            id,
            sessionId,
            title,
            createdAt: now,
            updatedAt: now
        };

        await this.db.run(
            `INSERT INTO agent_conversations (id, session_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
            [
                conversation.id,
                conversation.sessionId || null,
                conversation.title,
                conversation.createdAt,
                conversation.updatedAt
            ]
        );

        this.LOGGER.info(`创建新对话: ${id}, 标题: ${title}`);

        return conversation;
    }

    /**
     * 获取所有对话（按更新时间倒序）
     * @param sessionId 可选的会话 ID 过滤
     * @param limit 返回数量限制
     * @returns 对话列表
     */
    public async getAllConversations(sessionId?: string, limit: number = 100): Promise<AgentConversation[]> {
        let sql = `SELECT * FROM agent_conversations`;
        const params: any[] = [];

        if (sessionId) {
            sql += ` WHERE session_id = ?`;
            params.push(sessionId);
        }

        sql += ` ORDER BY updated_at DESC LIMIT ?`;
        params.push(limit);

        const rows = await this.db.all<AgentConversation>(sql, params);

        return rows;
    }

    /**
     * 获取对话分页（按更新时间倒序）
     * @param sessionId 可选的会话 ID 过滤
     * @param beforeUpdatedAt 分页游标：返回 updated_at < beforeUpdatedAt 的数据
     * @param limit 返回数量限制
     */
    public async getConversationsPage(
        sessionId: string | undefined,
        beforeUpdatedAt: number | undefined,
        limit: number
    ): Promise<AgentConversation[]> {
        let sql = `SELECT * FROM agent_conversations`;
        const params: any[] = [];

        const conditions: string[] = [];

        if (sessionId) {
            conditions.push(`session_id = ?`);
            params.push(sessionId);
        }
        if (beforeUpdatedAt !== undefined) {
            conditions.push(`updated_at < ?`);
            params.push(beforeUpdatedAt);
        }
        if (conditions.length > 0) {
            sql += ` WHERE ` + conditions.join(" AND ");
        }

        sql += ` ORDER BY updated_at DESC LIMIT ?`;
        params.push(limit);

        const rows = await this.db.all<AgentConversation>(sql, params);

        return rows;
    }

    /**
     * 根据 ID 获取对话
     * @param id 对话 ID
     * @returns 对话记录，不存在则返回 null
     */
    public async getConversationById(id: string): Promise<AgentConversation | null> {
        const row = await this.db.get<AgentConversation>(`SELECT * FROM agent_conversations WHERE id = ?`, [id]);

        return row || null;
    }

    /**
     * 更新对话标题
     * @param id 对话 ID
     * @param title 新标题
     */
    public async updateConversationTitle(id: string, title: string): Promise<void> {
        await this.db.run(`UPDATE agent_conversations SET title = ?, updated_at = ? WHERE id = ?`, [
            title,
            Date.now(),
            id
        ]);
        this.LOGGER.info(`更新对话标题: ${id} -> ${title}`);
    }

    /**
     * 更新对话的更新时间
     * @param id 对话 ID
     */
    public async touchConversation(id: string): Promise<void> {
        await this.db.run(`UPDATE agent_conversations SET updated_at = ? WHERE id = ?`, [Date.now(), id]);
    }

    /**
     * 删除对话（级联删除消息）
     * @param id 对话 ID
     */
    public async deleteConversation(id: string): Promise<void> {
        await this.db.run(`DELETE FROM agent_conversations WHERE id = ?`, [id]);
        this.LOGGER.info(`删除对话: ${id}`);
    }

    /**
     * 添加消息到对话
     * @param message 消息记录
     */
    public async addMessage(message: AgentMessage): Promise<void> {
        await this.db.run(
            `INSERT INTO agent_messages (id, conversation_id, role, content, timestamp, tools_used, tool_rounds, token_usage) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                message.id,
                message.conversationId,
                message.role,
                message.content,
                message.timestamp,
                message.toolsUsed || null,
                message.toolRounds || null,
                message.tokenUsage || null
            ]
        );

        // 更新对话的更新时间
        await this.touchConversation(message.conversationId);
    }

    /**
     * 获取对话的所有消息（按时间正序）
     * @param conversationId 对话 ID
     * @returns 消息列表
     */
    public async getMessagesByConversationId(conversationId: string): Promise<AgentMessage[]> {
        const rows = await this.db.all<AgentMessage>(
            `SELECT * FROM agent_messages WHERE conversation_id = ? ORDER BY timestamp ASC`,
            [conversationId]
        );

        return rows;
    }

    /**
     * 获取消息分页（按时间倒序取 limit 条，再翻转为正序返回，便于前端渲染）
     * @param conversationId 对话 ID
     * @param beforeTimestamp 分页游标：返回 timestamp < beforeTimestamp 的数据
     * @param limit 返回数量限制
     */
    public async getMessagesPage(
        conversationId: string,
        beforeTimestamp: number | undefined,
        limit: number
    ): Promise<AgentMessage[]> {
        let sql = `SELECT * FROM agent_messages WHERE conversation_id = ?`;
        const params: any[] = [conversationId];

        if (beforeTimestamp !== undefined) {
            sql += ` AND timestamp < ?`;
            params.push(beforeTimestamp);
        }

        sql += ` ORDER BY timestamp DESC LIMIT ?`;
        params.push(limit);

        const rows = await this.db.all<AgentMessage>(sql, params);

        // 返回正序，方便 UI 直接 append
        return rows.reverse();
    }

    /**
     * 删除消息
     * @param id 消息 ID
     */
    public async deleteMessage(id: string): Promise<void> {
        await this.db.run(`DELETE FROM agent_messages WHERE id = ?`, [id]);
        this.LOGGER.info(`删除消息: ${id}`);
    }

    /**
     * 获取对话的消息数量
     * @param conversationId 对话 ID
     * @returns 消息数量
     */
    public async getMessageCount(conversationId: string): Promise<number> {
        const result = await this.db.get<{ count: number }>(
            `SELECT COUNT(*) as count FROM agent_messages WHERE conversation_id = ?`,
            [conversationId]
        );

        return result?.count || 0;
    }
}
