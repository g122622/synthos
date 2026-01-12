/**
 * RAG 聊天历史记录数据库管理器
 * 使用 SQLite 存储用户的 RAG 问答历史会话
 */
import * as path from "path";
import sqlite3 from "sqlite3";
import { PromisifiedSQLite } from "@root/common/util/promisify/PromisifiedSQLite";
import { Disposable } from "@root/common/util/lifecycle/Disposable";
import Logger from "@root/common/util/Logger";

// ==================== 类型定义 ====================

/**
 * RAG 会话记录
 */
export interface RagChatSession {
    id: string;
    title: string;
    question: string;
    answer: string;
    refs: string; // JSON 字符串，存储 ReferenceItem[]
    topK: number;
    createdAt: number;
    updatedAt: number;
}

/**
 * 创建会话的输入参数
 */
export interface CreateSessionInput {
    id: string;
    title: string;
    question: string;
    answer: string;
    refs: string;
    topK: number;
}

/**
 * 会话列表项（用于侧边栏显示）
 */
export interface SessionListItem {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
}

// ==================== 数据库管理器 ====================

export class RagChatHistoryManager extends Disposable {
    private static instance: RagChatHistoryManager | null = null;
    private LOGGER = Logger.withTag("RagChatHistoryManager");
    private db: PromisifiedSQLite | null = null;
    private dbPath: string;
    private initialized: boolean = false;

    private constructor(dbBasePath: string) {
        super();
        this.dbPath = path.join(dbBasePath, "RagChatHistory.db");
    }

    /**
     * 获取单例实例
     */
    static getInstance(dbBasePath: string): RagChatHistoryManager {
        if (!RagChatHistoryManager.instance) {
            RagChatHistoryManager.instance = new RagChatHistoryManager(dbBasePath);
        }
        return RagChatHistoryManager.instance;
    }

    /**
     * 初始化数据库
     */
    async init(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            this.db = new PromisifiedSQLite(sqlite3);
            await this.db.open(this.dbPath);

            // 创建会话表
            await this.db.exec(`
                CREATE TABLE IF NOT EXISTS rag_sessions (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    question TEXT NOT NULL,
                    answer TEXT NOT NULL,
                    refs TEXT NOT NULL,
                    topK INTEGER NOT NULL,
                    createdAt INTEGER NOT NULL,
                    updatedAt INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_sessions_updatedAt ON rag_sessions(updatedAt DESC);
            `);

            this._registerDisposable(this.db);
            this.initialized = true;
            this.LOGGER.success("RAG 聊天历史数据库初始化完成");
        } catch (error) {
            this.LOGGER.error(`初始化数据库失败: ${error}`);
            throw error;
        }
    }

    /**
     * 确保数据库已初始化
     */
    private ensureInitialized(): void {
        if (!this.initialized || !this.db) {
            throw new Error("数据库未初始化，请先调用 init() 方法");
        }
    }

    /**
     * 创建新会话
     */
    async createSession(input: CreateSessionInput): Promise<RagChatSession> {
        this.ensureInitialized();

        const now = Date.now();
        const session: RagChatSession = {
            ...input,
            createdAt: now,
            updatedAt: now
        };

        await this.db!.run(
            `INSERT INTO rag_sessions (id, title, question, answer, refs, topK, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                session.id,
                session.title,
                session.question,
                session.answer,
                session.refs,
                session.topK,
                session.createdAt,
                session.updatedAt
            ]
        );

        this.LOGGER.info(`创建新会话: ${session.id}`);
        return session;
    }

    /**
     * 根据 ID 获取会话详情
     */
    async getSessionById(id: string): Promise<RagChatSession | null> {
        this.ensureInitialized();

        const result = (await this.db!.get(`SELECT * FROM rag_sessions WHERE id = ?`, [id])) as
            | RagChatSession
            | undefined;

        return result || null;
    }

    /**
     * 获取会话列表（按更新时间倒序）
     */
    async getSessionList(limit: number, offset: number): Promise<SessionListItem[]> {
        this.ensureInitialized();

        const results = (await this.db!.all(
            `SELECT id, title, createdAt, updatedAt FROM rag_sessions ORDER BY updatedAt DESC LIMIT ? OFFSET ?`,
            [limit, offset]
        )) as SessionListItem[];

        return results;
    }

    /**
     * 获取会话总数
     */
    async getSessionCount(): Promise<number> {
        this.ensureInitialized();

        const result = (await this.db!.get(`SELECT COUNT(*) as count FROM rag_sessions`)) as
            | { count: number }
            | undefined;

        return result?.count || 0;
    }

    /**
     * 删除会话
     */
    async deleteSession(id: string): Promise<boolean> {
        this.ensureInitialized();

        await this.db!.run(`DELETE FROM rag_sessions WHERE id = ?`, [id]);

        this.LOGGER.info(`删除会话: ${id}`);
        return true;
    }

    /**
     * 更新会话标题
     */
    async updateSessionTitle(id: string, title: string): Promise<boolean> {
        this.ensureInitialized();

        const now = Date.now();
        await this.db!.run(`UPDATE rag_sessions SET title = ?, updatedAt = ? WHERE id = ?`, [title, now, id]);

        this.LOGGER.info(`更新会话标题: ${id}`);
        return true;
    }

    /**
     * 清空所有会话
     */
    async clearAllSessions(): Promise<void> {
        this.ensureInitialized();

        await this.db!.run(`DELETE FROM rag_sessions`);
        this.LOGGER.info("清空所有会话");
    }
}

export default RagChatHistoryManager;
