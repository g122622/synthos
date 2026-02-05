import "reflect-metadata";
import * as fs from "fs/promises";
import * as path from "path";

import { injectable, container } from "tsyringe";
import sqlite3 from "sqlite3";

import Logger from "../../../util/Logger";
import { Disposable } from "../../../util/lifecycle/Disposable";
import { mustInitBeforeUse } from "../../../util/lifecycle/mustInitBeforeUse";
import { PromisifiedSQLite } from "../../../util/promisify/PromisifiedSQLite";
import { COMMON_TOKENS } from "../../../di/tokens";
import { ConfigManagerService } from "../../config/ConfigManagerService";

sqlite3.verbose();

export interface ImFtsSearchParams {
    query: string;
    /** 可选：限制群组范围；为空表示全量 */
    groupIds?: string[];
    /** 可选：起始时间戳（毫秒） */
    timeStart?: number;
    /** 可选：结束时间戳（毫秒） */
    timeEnd?: number;
    /** 页码（从 1 开始） */
    page: number;
    /** 每页条数 */
    pageSize: number;
}

export interface ImFtsSearchHit {
    msgId: string;
    groupId: string;
    timestamp: number;
    snippet: string;
    score: number;
}

export interface ImFtsSearchGroup {
    groupId: string;
    total: number;
    hits: ImFtsSearchHit[];
}

export interface ImFtsSearchResult {
    page: number;
    pageSize: number;
    /** 命中总数（应用了 group/time filter） */
    total: number;
    /** 按群分组的结果（群之间按命中数排序，群内按相关性排序） */
    groups: ImFtsSearchGroup[];
}

/**
 * IM 消息全文检索服务（FTS）
 *
 * 约束：
 * - 使用独立的 FTS 数据库文件（由配置 commonDatabase.ftsDatabase.imMessageDBPath 指定）。
 * - 不对现有聊天大数据库做任何写入。
 * - 索引构建由 db-cli 手动触发（可重建）。
 */
@injectable()
@mustInitBeforeUse
export class ImDbFtsService extends Disposable {
    private static readonly TABLE_NAME = "im_messages_fts";
    private LOGGER = Logger.withTag("ImDbFtsService");

    private db: PromisifiedSQLite | null = null;
    private isFts5 = true;
    private dbPath: string | null = null;

    private get _db(): PromisifiedSQLite {
        if (!this.db) {
            throw new Error("FTS 数据库尚未初始化");
        }

        return this.db;
    }

    public async init(): Promise<void> {
        const configManagerService = container.resolve<ConfigManagerService>(COMMON_TOKENS.ConfigManagerService);
        const config = await configManagerService.getCurrentConfig();

        this.dbPath = config.commonDatabase.ftsDatabase.imMessageDBPath;
        await fs.mkdir(path.dirname(this.dbPath), { recursive: true });

        this.db = this._registerDisposable(new PromisifiedSQLite(sqlite3));
        await this._db.open(this.dbPath);

        await this._initPragmas();
        await this._ensureSchema();
    }

    public getDBPath(): string {
        if (!this.dbPath) {
            throw new Error("FTS 数据库尚未初始化");
        }

        return this.dbPath;
    }

    /**
     * 重建索引（全量）。
     * @param messages 消息列表（建议来自主库 chat_messages 全量导出）
     */
    public async rebuildIndex(
        messages: Array<{
            msgId: string;
            groupId: string;
            timestamp: number;
            messageContent?: string;
            quotedMsgContent?: string;
            preProcessedContent?: string;
            senderGroupNickname?: string;
            senderNickname?: string;
            senderId?: string;
        }>
    ): Promise<void> {
        if (messages.length === 0) {
            this.LOGGER.warning("rebuildIndex 收到空数组，将跳过");

            return;
        }

        await this._dropAndRecreateTable();

        const MAX_SQLITE_PARAMS = 999;
        const paramsPerRecord = 9;
        const batchSize = Math.min(100, Math.floor(MAX_SQLITE_PARAMS / paramsPerRecord));

        await this._db.run("BEGIN IMMEDIATE TRANSACTION");
        try {
            for (let i = 0; i < messages.length; i += batchSize) {
                const batch = messages.slice(i, i + batchSize);
                const placeholders = new Array(batch.length).fill("(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
                const sql = `
					INSERT INTO ${ImDbFtsService.TABLE_NAME} (
						msgId, groupId, timestamp,
						messageContent, quotedMsgContent, preProcessedContent,
						senderGroupNickname, senderNickname, senderId
					) VALUES ${placeholders}
				`;

                const params: any[] = [];

                for (const msg of batch) {
                    params.push(
                        msg.msgId,
                        msg.groupId,
                        msg.timestamp,
                        msg.messageContent || "",
                        msg.quotedMsgContent || "",
                        msg.preProcessedContent || "",
                        msg.senderGroupNickname || "",
                        msg.senderNickname || "",
                        msg.senderId || ""
                    );
                }

                await this._db.run(sql, params);
            }
            await this._db.run("COMMIT");
        } catch (err) {
            await this._db.run("ROLLBACK");
            this.LOGGER.error(`重建 FTS 索引失败：${err instanceof Error ? err.message : String(err)}`);
            throw err;
        }

        this.LOGGER.success(`FTS 索引重建完成：共写入 ${messages.length} 条`);
    }

    /**
     * 全文搜索（纯文本模式）
     *
     * 结果排序：群之间按命中数降序；群内按相关性优先，其次时间。
     */
    public async search(params: ImFtsSearchParams): Promise<ImFtsSearchResult> {
        const resolvedPage = Math.max(1, Math.floor(params.page));
        const resolvedPageSize = Math.max(1, Math.floor(params.pageSize));
        const offset = (resolvedPage - 1) * resolvedPageSize;

        const matchQuery = this._buildMatchQuery(params.query);

        if (!matchQuery) {
            return {
                page: resolvedPage,
                pageSize: resolvedPageSize,
                total: 0,
                groups: []
            };
        }

        const whereSqlParts: string[] = [`${ImDbFtsService.TABLE_NAME} MATCH ?`];
        const whereParams: any[] = [matchQuery];

        if (params.groupIds && params.groupIds.length > 0) {
            const placeholders = params.groupIds.map(() => "?").join(", ");

            whereSqlParts.push(`groupId IN (${placeholders})`);
            whereParams.push(...params.groupIds);
        }

        if (typeof params.timeStart === "number") {
            whereSqlParts.push("timestamp >= ?");
            whereParams.push(params.timeStart);
        }
        if (typeof params.timeEnd === "number") {
            whereSqlParts.push("timestamp <= ?");
            whereParams.push(params.timeEnd);
        }

        const whereSql = whereSqlParts.join(" AND ");

        const totalRow = (await this._db.get(
            `SELECT COUNT(*) AS total FROM ${ImDbFtsService.TABLE_NAME} WHERE ${whereSql}`,
            whereParams
        )) as { total: number } | undefined;
        const total = totalRow ? (totalRow.total as number) : 0;

        if (total === 0) {
            return {
                page: resolvedPage,
                pageSize: resolvedPageSize,
                total: 0,
                groups: []
            };
        }

        // FTS5: 用 bm25 进行相关性排序；FTS4: 缺少 bm25，降级为按时间排序
        const scoreSql = this.isFts5 ? `bm25(${ImDbFtsService.TABLE_NAME})` : "0";
        const snippetSql = this.isFts5 ? `snippet(${ImDbFtsService.TABLE_NAME}, -1, '', '', '…', 10)` : `''`;

        const sql = `
			WITH matched AS (
				SELECT
					msgId,
					groupId,
					timestamp,
					${snippetSql} AS snippet,
					${scoreSql} AS score
				FROM ${ImDbFtsService.TABLE_NAME}
				WHERE ${whereSql}
			),
			group_counts AS (
				SELECT groupId, COUNT(*) AS groupCount
				FROM matched
				GROUP BY groupId
			),
			ranked AS (
				SELECT
					m.msgId,
					m.groupId,
					m.timestamp,
					m.snippet,
					m.score,
					gc.groupCount
				FROM matched m
				JOIN group_counts gc ON gc.groupId = m.groupId
			)
			SELECT *
			FROM ranked
			ORDER BY groupCount DESC, score ASC, timestamp DESC
			LIMIT ? OFFSET ?
		`;

        const rows = (await this._db.all(sql, [...whereParams, resolvedPageSize, offset])) as Array<{
            msgId: string;
            groupId: string;
            timestamp: number;
            snippet: string;
            score: number;
            groupCount: number;
        }>;

        // 组装为按群分组的结果结构（群内保持 SQL 排序）
        const groupMap = new Map<string, ImFtsSearchGroup>();
        const groupTotalMap = new Map<string, number>();

        // 先取所有 groupCount（来自 rows）
        for (const row of rows) {
            if (!groupTotalMap.has(row.groupId)) {
                groupTotalMap.set(row.groupId, row.groupCount);
            }
        }

        for (const row of rows) {
            if (!groupMap.has(row.groupId)) {
                groupMap.set(row.groupId, {
                    groupId: row.groupId,
                    total: groupTotalMap.get(row.groupId) || 0,
                    hits: []
                });
            }

            groupMap.get(row.groupId)!.hits.push({
                msgId: row.msgId,
                groupId: row.groupId,
                timestamp: row.timestamp,
                snippet: row.snippet || "",
                score: typeof row.score === "number" ? row.score : 0
            });
        }

        // 群排序：按 total 降序
        const groups = Array.from(groupMap.values()).sort((a, b) => b.total - a.total);

        return {
            page: resolvedPage,
            pageSize: resolvedPageSize,
            total,
            groups
        };
    }

    // ==================== 内部实现 ====================

    private async _initPragmas(): Promise<void> {
        // 这些 pragma 是可选的性能优化，不影响正确性
        await this._db.exec("PRAGMA journal_mode = WAL;");
        await this._db.exec("PRAGMA synchronous = NORMAL;");
        await this._db.exec("PRAGMA temp_store = MEMORY;");
    }

    private async _ensureSchema(): Promise<void> {
        try {
            await this._db.exec(this._getCreateFts5Sql());
            this.isFts5 = true;

            return;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);

            this.LOGGER.warning(`尝试初始化 FTS5 失败，将降级到 FTS4。错误：${msg}`);
        }

        await this._db.exec(this._getCreateFts4Sql());
        this.isFts5 = false;
    }

    private async _dropAndRecreateTable(): Promise<void> {
        await this._db.exec(`DROP TABLE IF EXISTS ${ImDbFtsService.TABLE_NAME};`);
        await this._ensureSchema();
    }

    private _getCreateFts5Sql(): string {
        // UNINDEXED：用于过滤/排序/分组，但不参与索引。
        return `
			CREATE VIRTUAL TABLE IF NOT EXISTS ${ImDbFtsService.TABLE_NAME} USING fts5(
				msgId UNINDEXED,
				groupId UNINDEXED,
				timestamp UNINDEXED,
				messageContent,
				quotedMsgContent,
				preProcessedContent,
				senderGroupNickname,
				senderNickname,
				senderId,
				tokenize='unicode61'
			);
		`;
    }

    private _getCreateFts4Sql(): string {
        // FTS4 不支持 UNINDEXED，且相关性排序能力弱；这里只做兜底。
        return `
			CREATE VIRTUAL TABLE IF NOT EXISTS ${ImDbFtsService.TABLE_NAME} USING fts4(
				msgId,
				groupId,
				timestamp,
				messageContent,
				quotedMsgContent,
				preProcessedContent,
				senderGroupNickname,
				senderNickname,
				senderId
			);
		`;
    }

    /**
     * 将用户输入的“纯文本”转换为 FTS MATCH 查询。
     *
     * 设计目标：
     * - 避免用户输入 FTS 语法导致解析错误。
     * - 默认以空白分词并做 AND（FTS 默认行为）。
     */
    private _buildMatchQuery(raw: string): string {
        const tokens = this._splitToTokens(raw);

        if (tokens.length === 0) {
            return "";
        }

        // FTS5: "token" 形式可以避免特殊字符触发语法
        return tokens.map(t => `"${this._escapeDoubleQuotes(t)}"`).join(" ");
    }

    private _escapeDoubleQuotes(input: string): string {
        // SQLite FTS 的引号转义规则：双引号用两个双引号表示
        return input.split('"').join('""');
    }

    private _splitToTokens(input: string): string[] {
        const trimmed = input.trim();

        if (!trimmed) {
            return [];
        }

        const result: string[] = [];
        let current = "";

        const flush = () => {
            const token = current.trim();

            current = "";
            if (!token) {
                return;
            }
            // 过滤掉纯符号 token（减少 FTS 解析风险）
            if (this._hasSearchableChar(token)) {
                result.push(token);
            }
        };

        for (let i = 0; i < trimmed.length; i++) {
            const ch = trimmed[i];

            if (this._isWhitespaceChar(ch)) {
                flush();
                continue;
            }
            current += ch;
        }
        flush();

        return result;
    }

    private _isWhitespaceChar(ch: string): boolean {
        // 覆盖常见空白（避免使用正则）
        return ch === " " || ch === "\n" || ch === "\r" || ch === "\t" || ch === "\u3000";
    }

    private _hasSearchableChar(token: string): boolean {
        for (let i = 0; i < token.length; i++) {
            const code = token.charCodeAt(i);
            const isDigit = code >= 48 && code <= 57;
            const isUpper = code >= 65 && code <= 90;
            const isLower = code >= 97 && code <= 122;
            const isCJK = code >= 0x4e00 && code <= 0x9fff;

            if (isDigit || isUpper || isLower || isCJK) {
                return true;
            }
        }

        return false;
    }
}
