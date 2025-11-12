import { readdir, mkdir } from "fs/promises";
import { join, basename, extname } from "path";
import { PromisifiedSQLite, PromisifiedStatement } from "../util/promisify/PromisifiedSQLite";
import Logger from "../util/Logger";
import { deepUnique } from "../util/deepUnique";
const sqlite3 = require("sqlite3").verbose();

interface CommonDatabaseConfig {
    dbBasePath: string;
    maxDBDuration: number; // in days
    initialSQL?: string; // 初始SQL语句，用于创建表等。建立每个数据库连接时会自动执行一次
}

class MultiFileSQLite {
    private config: CommonDatabaseConfig;
    private sqlite3: any;
    private LOGGER = Logger.withTag("MultiFileSQLite");

    // 缓存所有已打开的数据库连接：path → PromisifiedSQLite
    private dbCache = new Map<string, PromisifiedSQLite>();

    // 当前活跃数据库信息
    private activeDBPath: string | null = null;
    private activeDBTimestamp: number | null = null; // seconds

    private initialSQL = ""; // 初始SQL语句，用于创建表等。建立每个数据库连接时会自动执行一次

    constructor(config: CommonDatabaseConfig) {
        this.sqlite3 = sqlite3;
        this.config = config;
        this.initialSQL = config.initialSQL || "";

        // 释放
        process.on("SIGINT", async () => {
            this.LOGGER.warning("SIGINT received, closing...");
            await this.close();
            this.LOGGER.success("Closed!");
            process.exit(0);
        });

        this.LOGGER.info("初始化完成！");
    }

    // 确保 dbBasePath 存在
    private async ensureBasePath(): Promise<void> {
        try {
            await mkdir(this.config.dbBasePath, { recursive: true });
        } catch (err) {
            this.LOGGER.error(`Failed to create dbBasePath: ${err.message}`);
            throw err;
        }
    }

    // 获取所有数据库文件（按时间戳升序）
    private async getAllDBPaths(): Promise<{ path: string; timestamp: number }[]> {
        await this.ensureBasePath();
        const files = await readdir(this.config.dbBasePath);
        const dbFiles = files
            .filter(file => extname(file) === ".db")
            .map(file => {
                const name = basename(file, ".db");
                const ts = parseInt(name, 10);
                return isNaN(ts)
                    ? null
                    : { path: join(this.config.dbBasePath, file), timestamp: ts };
            })
            .filter(Boolean) as { path: string; timestamp: number }[];

        dbFiles.sort((a, b) => a.timestamp - b.timestamp); // 升序排序
        return dbFiles;
    }

    // 获取或创建 PromisifiedSQLite 实例（带缓存）
    private async getOrCreateDB(path: string): Promise<PromisifiedSQLite> {
        if (this.dbCache.has(path)) {
            return this.dbCache.get(path)!;
        }

        const db = new PromisifiedSQLite(this.sqlite3);
        await db.open(path);
        if (this.initialSQL) {
            await db.exec(this.initialSQL);
        }
        this.dbCache.set(path, db);
        return db;
    }

    // 获取当前活跃数据库（自动滚动）
    private async getActiveDB(): Promise<PromisifiedSQLite> {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const maxDurationSec = this.config.maxDBDuration * 24 * 3600;

        // 检查是否需要切换到新库
        if (
            this.activeDBPath &&
            this.activeDBTimestamp &&
            nowSeconds - this.activeDBTimestamp > maxDurationSec
        ) {
            // 标记旧库为非活跃，但不关闭（仍可能用于读）
            this.activeDBPath = null;
            this.activeDBTimestamp = null;
        }

        if (!this.activeDBPath) {
            const dbFiles = await this.getAllDBPaths();
            const latest = dbFiles.length > 0 ? dbFiles[dbFiles.length - 1] : null;

            if (latest && nowSeconds - latest.timestamp <= maxDurationSec) {
                // 复用最新库
                this.activeDBPath = latest.path;
                this.activeDBTimestamp = latest.timestamp;
                this.LOGGER.debug(`Reusing existing DB: ${latest.path}`);
            } else {
                // 创建新库
                this.activeDBTimestamp = nowSeconds;
                this.activeDBPath = join(this.config.dbBasePath, `${this.activeDBTimestamp}.db`);
                this.LOGGER.info(`Creating new DB: ${this.activeDBPath}`);
                // 确保写入时自动创建连接
            }
        }

        return this.getOrCreateDB(this.activeDBPath!);
    }

    // ========== 写操作（仅活跃库） ==========

    public async run(sql: string, params: any[] = []): Promise<void> {
        const db = await this.getActiveDB();
        return db.run(sql, params);
    }

    public async exec(sql: string): Promise<void> {
        const db = await this.getActiveDB();
        return db.exec(sql);
    }

    public async prepare(sql: string): Promise<PromisifiedStatement> {
        const db = await this.getActiveDB();
        return db.prepare(sql);
    }

    public async loadExtension(extensionPath: string): Promise<void> {
        const db = await this.getActiveDB();
        return db.loadExtension(extensionPath);
    }

    // ========== 读操作（遍历所有库，复用连接） ==========

    public async get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
        const dbFiles = await this.getAllDBPaths();
        // 从最新到最旧查询（适合找最新记录）
        for (let i = dbFiles.length - 1; i >= 0; i--) {
            const db = await this.getOrCreateDB(dbFiles[i].path);
            try {
                const row = await db.get(sql, params);
                if (sql.includes("EXISTS")) {
                    // 如果是 EXISTS 查询，只要找到一个就返回
                    if (row[Object.keys(row)[0]] >= 1) return row[Object.keys(row)[0]];
                } else {
                    if (row !== undefined) return row;
                }
            } catch (err) {
                this.LOGGER.error(`Error in get() on ${dbFiles[i].path}: ${err.message}`);
                throw err;
            }
        }
        return undefined;
    }

    public async all<T>(sql: string, params: any[] = []): Promise<T[]> {
        const dbFiles = await this.getAllDBPaths();
        let allRows: T[] = [];
        for (const dbInfo of dbFiles) {
            const db = await this.getOrCreateDB(dbInfo.path);
            try {
                const rows = await db.all(sql, params);
                allRows = allRows.concat(rows);
            } catch (err) {
                this.LOGGER.error(`Error in all() on ${dbInfo.path}: ${err.message}`);
                throw err;
            }
        }
        // 对所有row进行深度比较，去重
        allRows = deepUnique(allRows);
        return allRows;
    }

    public async each(
        sql: string,
        params: any[] = [],
        callback: (err: Error | null, row: any) => void
    ): Promise<void> {
        const dbFiles = await this.getAllDBPaths();
        for (const dbInfo of dbFiles) {
            const db = await this.getOrCreateDB(dbInfo.path);
            try {
                await db.each(sql, params, callback);
            } catch (err) {
                this.LOGGER.error(`Error in each() on ${dbInfo.path}: ${err.message}`);
                callback(err, null);
            }
        }
    }

    // ========== 资源管理 ==========

    public async close(): Promise<void> {
        // 关闭所有缓存的数据库连接
        const closePromises: Promise<void>[] = [];
        this.dbCache.forEach((db, path) => {
            closePromises.push(
                db.close().catch(err => {
                    this.LOGGER.error(`Error closing ${path}: ${err.message}`);
                })
            );
        });
        await Promise.all(closePromises);
        this.dbCache.clear();
        this.activeDBPath = null;
        this.activeDBTimestamp = null;
    }
}

export { MultiFileSQLite };
