import { ImDbAccessService} from "@root/common/services/database/ImDbAccessService";
import { AgcDbAccessService} from "@root/common/services/database/AgcDbAccessService";
import { InterestScoreDbAccessService } from "@root/common/services/database/InterestScoreDbAccessService";
import { PromisifiedSQLite } from "@root/common/util/promisify/PromisifiedSQLite";
import sqlite3 from "sqlite3";
import Logger from "@root/common/util/Logger";
import { Disposable } from "@root/common/util/lifecycle/Disposable";
import { IApplication } from "@/contracts/IApplication";
import { mustInitBeforeUse } from "@root/common/util/lifecycle/mustInitBeforeUse";

@mustInitBeforeUse
export class MigrateDB extends Disposable implements IApplication {
    public static readonly appName = "数据库迁移";
    public static readonly description = "将旧数据库迁移到新的统一数据库文件";

    private LOGGER = Logger.withTag("数据库迁移任务");
    private imdbDBManager: ImDbAccessService = this._registerDisposable(new ImDbAccessService());
    private agcDbAccessService: AgcDbAccessService = this._registerDisposable(new AgcDbAccessService());
    private interestScoreDbAccessService: InterestScoreDbAccessService = this._registerDisposable(new InterestScoreDbAccessService());

    public async init() {
        await this.imdbDBManager.init();
        await this.agcDbAccessService.init();
        await this.interestScoreDbAccessService.init();

        this.LOGGER.info("初始化完成！");
    }

    public async run() {
        const newDB = new PromisifiedSQLite(sqlite3);
        await newDB.open("migrated_database.db");
        this.LOGGER.success("已创建新的数据库文件 migrated_database.db");

        // pragma 设置
        await newDB.run("PRAGMA journal_mode = WAL;");
        await newDB.run("PRAGMA synchronous = NORMAL;");
        await newDB.run("PRAGMA temp_store = MEMORY;");
        await newDB.run("PRAGMA cache_size = -100000;"); // 约 100MB
        await newDB.run("PRAGMA threads = 16;"); // 多线程

        // 创建表结构
        this.LOGGER.info("创建表结构...");
        const createIMDBTableSQL = `
                CREATE TABLE chat_messages (
                    msgId TEXT NOT NULL PRIMARY KEY,
                    messageContent TEXT,
                    groupId TEXT,
                    timestamp INTEGER,
                    senderId TEXT,
                    senderGroupNickname TEXT,
                    senderNickname TEXT,
                    quotedMsgId TEXT,
                    quotedMsgContent TEXT,
                    sessionId TEXT,
                    preProcessedContent TEXT
                );`
        const createAGCTableSQL = `
                CREATE TABLE IF NOT EXISTS ai_digest_results (
                    topicId TEXT NOT NULL PRIMARY KEY,
                    sessionId TEXT,
                    topic TEXT,
                    contributors TEXT,
                    detail TEXT,
                    modelName TEXT,
                    updateTime INTEGER
                );`
        const createInterestScoreTableSQL = `
                CREATE TABLE IF NOT EXISTS interset_score_results (
                    topicId TEXT NOT NULL PRIMARY KEY,
                    scoreV1 REAL,
                    scoreV2 REAL,
                    scoreV3 REAL,
                    scoreV4 REAL,
                    scoreV5 REAL
                );`
        await newDB.run(createIMDBTableSQL);
        await newDB.run(createAGCTableSQL);
        await newDB.run(createInterestScoreTableSQL);
        this.LOGGER.info("创建表结构成功");

        // 建立索引
        this.LOGGER.info("创建索引...");
        await newDB.run(`CREATE INDEX idx_chat_messages_sessionId ON chat_messages (sessionId);`);
        await newDB.run(`CREATE INDEX idx_chat_messages_groupId ON chat_messages (groupId);`);
        await newDB.run(`CREATE INDEX idx_ai_digest_results_sessionId ON ai_digest_results (sessionId);`);
        this.LOGGER.info("创建索引成功");

        // 迁移 IMDB 数据库
        this.LOGGER.info("开始迁移 IMDB 数据库...");
        const allImdbData = await this.imdbDBManager.selectAll();
        this.LOGGER.info(`已获取 IMDB 数据库所有数据，共 ${allImdbData.length} 条记录`);
        await newDB.run(`BEGIN IMMEDIATE TRANSACTION`);
        try {
            for (const data of allImdbData) {
                await newDB.run(`INSERT INTO chat_messages VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    data.msgId,
                    data.messageContent,
                    data.groupId,
                    data.timestamp,
                    data.senderId,
                    data.senderGroupNickname,
                    data.senderNickname,
                    data.quotedMsgId,
                    data.quotedMsgContent,
                    data.sessionId,
                    data.preProcessedContent
                ]);
            }
            await newDB.run(`COMMIT`);
        } catch (error) {
            await newDB.run(`ROLLBACK`);
            throw error;
        }
        this.LOGGER.success("已迁移 IMDB 数据库所有数据");

        // 迁移 AGC 数据库
        this.LOGGER.info("开始迁移 AGC 数据库...");
        const allAgcData = await this.agcDbAccessService.selectAll();
        this.LOGGER.info(`已获取 AGC 数据库所有数据，共 ${allAgcData.length} 条记录`);
        await newDB.run(`BEGIN IMMEDIATE TRANSACTION`);
        try {
            for (const data of allAgcData) {
                await newDB.run(
                    `INSERT INTO ai_digest_results VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        data.topicId,
                        data.sessionId,
                        data.topic,
                        data.contributors,
                        data.detail,
                        undefined, // modelName 旧数据库没有该字段，暂时插入 undefined
                        undefined  // updateTime 旧数据库没有该字段，暂时插入 undefined
                    ]
                );
            }
            await newDB.run(`COMMIT`);
        } catch (error) {
            await newDB.run(`ROLLBACK`);
            throw error;
        }
        this.LOGGER.success("已迁移 AGC 数据库所有数据");

        // 迁移 Interest Score 数据库
        this.LOGGER.info("开始迁移 Interest Score 数据库...");
        const allInterestScoreData = await this.interestScoreDbAccessService.selectAll();
        this.LOGGER.info(
            `已获取 Interest Score 数据库所有数据，共 ${allInterestScoreData.length} 条记录`
        );
        await newDB.run(`BEGIN IMMEDIATE TRANSACTION`);
        try {
            for (const data of allInterestScoreData) {
                await newDB.run(
                    `INSERT INTO interset_score_results VALUES (?, ?, ?, ?, ?, ?)`, [
                    data.topicId,
                    data.scoreV1,
                    undefined,
                    undefined,
                    undefined,
                    undefined
                ]
                );
            }
            await newDB.run(`COMMIT`);
        } catch (error) {
            await newDB.run(`ROLLBACK`);
            throw error;
        }
        this.LOGGER.success("已迁移 Interest Score 数据库所有数据");

        await newDB.dispose();
        this.LOGGER.success("已关闭数据库连接");
        this.LOGGER.success("数据库迁移完成");
    }

}