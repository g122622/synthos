/**
 * RAG 聊天历史记录数据库管理器
 * 使用 SQLite 存储用户的 RAG 问答历史会话
 */
import * as path from "path";
import sqlite3 from "sqlite3";
import { PromisifiedSQLite } from "@root/common/util/promisify/PromisifiedSQLite";
import { Disposable } from "@root/common/util/lifecycle/Disposable";
import Logger from "@root/common/util/Logger";
import type { RagChatSession, CreateSessionInput, SessionListItem } from "../types/rag-session";

// ====================  数据库管理器 ====================

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
                    enableQueryRewriter INTEGER NOT NULL DEFAULT 1,
                    isFailed INTEGER NOT NULL DEFAULT 0,
                    failReason TEXT NOT NULL DEFAULT '',
                    pinned INTEGER NOT NULL DEFAULT 0,
                    createdAt INTEGER NOT NULL,
                    updatedAt INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_sessions_updatedAt ON rag_sessions(updatedAt DESC);
            `);

            // 兼容旧数据库：补齐字段
            const columns = (await this.db.all(`PRAGMA table_info(rag_sessions)`)) as Array<{ name?: string }>;

            const hasEnableQueryRewriter = columns.some(col => col.name === "enableQueryRewriter");
            if (!hasEnableQueryRewriter) {
                await this.db.run(
                    `ALTER TABLE rag_sessions ADD COLUMN enableQueryRewriter INTEGER NOT NULL DEFAULT 1`
                );
                this.LOGGER.info("已为 rag_sessions 表补齐 enableQueryRewriter 字段");
            }

            const hasIsFailed = columns.some(col => col.name === "isFailed");
            if (!hasIsFailed) {
                await this.db.run(`ALTER TABLE rag_sessions ADD COLUMN isFailed INTEGER NOT NULL DEFAULT 0`);
                this.LOGGER.info("已为 rag_sessions 表补齐 isFailed 字段");
            }

            const hasFailReason = columns.some(col => col.name === "failReason");
            if (!hasFailReason) {
                await this.db.run(`ALTER TABLE rag_sessions ADD COLUMN failReason TEXT NOT NULL DEFAULT ''`);
                this.LOGGER.info("已为 rag_sessions 表补齐 failReason 字段");
            }

            const hasPinned = columns.some(col => col.name === "pinned");
            if (!hasPinned) {
                await this.db.run(`ALTER TABLE rag_sessions ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`);
                this.LOGGER.info("已为 rag_sessions 表补齐 pinned 字段");
            }

            // 创建 pinned 相关的索引（在字段迁移之后）
            await this.db.exec(`
                CREATE INDEX IF NOT EXISTS idx_sessions_pinned_updatedAt ON rag_sessions(pinned DESC, updatedAt DESC);
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
            `INSERT INTO rag_sessions (id, title, question, answer, refs, topK, enableQueryRewriter, isFailed, failReason, pinned, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                session.id,
                session.title,
                session.question,
                session.answer,
                session.refs,
                session.topK,
                session.enableQueryRewriter ? 1 : 0,
                session.isFailed ? 1 : 0,
                session.failReason,
                session.pinned ? 1 : 0,
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
     * 获取会话列表（按置顶状态和更新时间倒序）
     */
    async getSessionList(limit: number, offset: number): Promise<SessionListItem[]> {
        this.ensureInitialized();

        const results = (await this.db!.all(
            `SELECT id, title, isFailed, pinned, createdAt, updatedAt FROM rag_sessions ORDER BY pinned DESC, updatedAt DESC LIMIT ? OFFSET ?`,
            [limit, offset]
        )) as Array<{
            id: string;
            title: string;
            isFailed: number;
            pinned: number;
            createdAt: number;
            updatedAt: number;
        }>;

        return results.map(r => ({
            id: r.id,
            title: r.title,
            isFailed: !!r.isFailed,
            pinned: !!r.pinned,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt
        }));
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

    /**
     * 切换会话的置顶状态
     */
    async toggleSessionPin(id: string, pinned: boolean): Promise<boolean> {
        this.ensureInitialized();

        const now = Date.now();
        await this.db!.run(`UPDATE rag_sessions SET pinned = ?, updatedAt = ? WHERE id = ?`, [
            pinned ? 1 : 0,
            now,
            id
        ]);

        this.LOGGER.info(`${pinned ? "置顶" : "取消置顶"}会话: ${id}`);
        return true;
    }
}

export default RagChatHistoryManager;
