import "reflect-metadata";
import * as fs from "fs/promises";
import * as path from "path";

import { injectable, inject } from "tsyringe";
import sqlite3 from "sqlite3";

import { PromisifiedSQLite, PromisifiedStatement } from "../../../util/promisify/PromisifiedSQLite";
import Logger from "../../../util/Logger";
import { Disposable } from "../../../util/lifecycle/Disposable";
import { ConfigManagerService } from "../../config/ConfigManagerService";
import { mustInitBeforeUse } from "../../../util/lifecycle/mustInitBeforeUse";
import { COMMON_TOKENS } from "../../../di/tokens";
sqlite3.verbose();

/**
 * 通用数据库服务
 * 提供 SQLite 数据库的基础操作能力
 */
@injectable()
@mustInitBeforeUse
export class CommonDBService extends Disposable {
    private LOGGER = Logger.withTag("CommonDBService");
    private db: PromisifiedSQLite;

    /**
     * 构造函数
     * @param configManagerService 配置管理服务
     */
    public constructor(
        @inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService
    ) {
        super();
        this.db = this._registerDisposable(new PromisifiedSQLite(sqlite3));
        this.LOGGER.info("初始化完成！");
    }

    /**
     * 初始化数据库连接
     * @param initialSQL 初始 SQL 语句，用于创建表等，建立连接时会自动执行一次
     */
    public async init(initialSQL?: string): Promise<void> {
        // 确保 dbBasePath 存在
        const config = await this.configManagerService.getCurrentConfig();

        try {
            await fs.mkdir(config.commonDatabase.dbBasePath, { recursive: true });
        } catch (err) {
            this.LOGGER.error(`Failed to create dbBasePath: ${err.message}`);
            throw err;
        }
        await this.db.open(path.join(config.commonDatabase.dbBasePath, "common_database.db"));
        if (initialSQL) {
            await this.db.exec(initialSQL);
        }
    }

    // ========== 写操作（仅活跃库） ==========

    public async run(sql: string, params: any[] = []): Promise<void> {
        return this.db.run(sql, params);
    }

    public async exec(sql: string): Promise<void> {
        return this.db.exec(sql);
    }

    public async prepare(sql: string): Promise<PromisifiedStatement> {
        return this.db.prepare(sql);
    }

    public async loadExtension(extensionPath: string): Promise<void> {
        return this.db.loadExtension(extensionPath);
    }

    public async get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
        return this.db.get(sql, params);
    }

    public async all<T>(sql: string, params: any[] = []): Promise<T[]> {
        return this.db.all(sql, params);
    }

    public async each(
        sql: string,
        params: any[] = [],
        callback: (err: Error | null, row: any) => void
    ): Promise<void> {
        return this.db.each(sql, params, callback);
    }
}
