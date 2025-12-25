import * as fs from "fs/promises";
import * as path from "path";
import { PromisifiedSQLite, PromisifiedStatement } from "../util/promisify/PromisifiedSQLite";
import Logger from "../util/Logger";
import { Disposable } from "../util/lifecycle/Disposable";
import sqlite3 from "sqlite3";
import { getConfigManagerService } from "../di/container";
import { mustInitBeforeUse } from "../util/lifecycle/mustInitBeforeUse";
sqlite3.verbose();

// TODO 单例化
@mustInitBeforeUse
export class CommonDBService extends Disposable {
    private LOGGER = Logger.withTag("CommonDBService");
    private initialSQL = ""; // 初始SQL语句，用于创建表等。建立每个数据库连接时会自动执行一次
    private configManagerService = getConfigManagerService();
    private db = new PromisifiedSQLite(sqlite3);

    constructor(initialSQL?: string) {
        super();
        this.initialSQL = initialSQL || "";
        this.db = this._registerDisposable(new PromisifiedSQLite(sqlite3));
        this.LOGGER.info("初始化完成！");
    }

    async init(): Promise<void> {
        // 确保 dbBasePath 存在
        try {
            await fs.mkdir(
                (await this.configManagerService.getCurrentConfig()).commonDatabase.dbBasePath,
                { recursive: true }
            );
        } catch (err) {
            this.LOGGER.error(`Failed to create dbBasePath: ${err.message}`);
            throw err;
        }
        await this.db.open(
            path.join(
                (await this.configManagerService.getCurrentConfig()).commonDatabase.dbBasePath,
                "common_database.db"
            )
        );
        if (this.initialSQL) {
            await this.db.exec(this.initialSQL);
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
