import "reflect-metadata";
import { getConfigManagerService } from "../di/container";
import {
    ProcessedChatMessage,
    RawChatMessage,
    ProcessedChatMessageWithRawMessage
} from "../contracts/data-provider/index";
import Logger from "../util/Logger";
import { MultiFileSQLite } from "./MultiFileSQLite";
import { Disposable } from "../util/lifecycle/Disposable";
import { mustInitBeforeUse } from "../util/lifecycle/mustInitBeforeUse";

@mustInitBeforeUse
export class IMDBManager extends Disposable {
    private LOGGER = Logger.withTag("IMDBManager");
    private db: MultiFileSQLite;

    public async init() {
        const configService = getConfigManagerService();
        this.db = new MultiFileSQLite({
            dbBasePath: (await configService.getCurrentConfig()).commonDatabase.dbBasePath,
            maxDBDuration: (await configService.getCurrentConfig()).commonDatabase.maxDBDuration,
            initialSQL: `
                CREATE TABLE IF NOT EXISTS chat_messages (
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
        });
        this._registerDisposable(this.db);

        // =============== 执行数据库迁移 ===============
        // this.LOGGER.info("执行数据库迁移...");
        // await this.db.migrateDatabases([
        //     // 兼容旧版本 SQLite 的备选方案
        //     `CREATE TABLE IF NOT EXISTS chat_messages_new (
        //         msgId TEXT NOT NULL PRIMARY KEY,
        //         messageContent TEXT,
        //         groupId TEXT,
        //         timestamp INTEGER,
        //         senderId TEXT,
        //         senderGroupNickname TEXT,
        //         senderNickname TEXT,
        //         quotedMsgId TEXT,
        //         quotedMsgContent TEXT,
        //         sessionId TEXT,
        //         preProcessedContent TEXT
        //     );
        //     INSERT INTO chat_messages_new SELECT
        //         msgId, messageContent, groupId, timestamp, senderId,
        //         senderGroupNickname, senderNickname, quotedMsgId,
        //         NULL AS quotedMsgContent,  -- 初始化新字段为NULL
        //         sessionId, preProcessedContent
        //     FROM chat_messages;
        //     DROP TABLE chat_messages;
        //     ALTER TABLE chat_messages_new RENAME TO chat_messages;`
        // ]);
        // ============================================
    }

    public async storeRawChatMessage(msg: RawChatMessage) {
        await this.db.run(
            `INSERT INTO chat_messages (
                msgId, messageContent, groupId, timestamp, senderId, senderGroupNickname, senderNickname, quotedMsgId, quotedMsgContent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(msgId) DO UPDATE SET
                messageContent = excluded.messageContent,
                groupId = excluded.groupId,
                timestamp = excluded.timestamp,
                senderId = excluded.senderId,
                senderGroupNickname = excluded.senderGroupNickname,
                senderNickname = excluded.senderNickname,
                quotedMsgId = excluded.quotedMsgId,
                quotedMsgContent = excluded.quotedMsgContent`,
            [
                msg.msgId,
                msg.messageContent,
                msg.groupId,
                msg.timestamp,
                msg.senderId,
                msg.senderGroupNickname,
                msg.senderNickname,
                msg.quotedMsgId,
                msg.quotedMsgContent
            ]
        );
    }

    public async storeRawChatMessages(messages: RawChatMessage[]) {
        if (messages.length === 0) return;

        // 获取当前活跃数据库连接（确保整个操作在同一个连接）
        const activeDB = await this.db.getActiveDB(); // 需要将 getActiveDB 改为 public 或 protected

        // 计算每批大小（每条消息9个参数，SQLite 默认最大999参数）
        const MAX_SQLITE_PARAMS = 999;
        const paramsPerRecord = 9;
        const batchSize = Math.min(100, Math.floor(MAX_SQLITE_PARAMS / paramsPerRecord));

        // 构建基础SQL模板（带冲突处理）
        const baseSql = `
        INSERT INTO chat_messages (
            msgId, messageContent, groupId, timestamp, senderId, 
            senderGroupNickname, senderNickname, quotedMsgId, quotedMsgContent
        ) VALUES ${Array(batchSize).fill("(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}
        ON CONFLICT(msgId) DO UPDATE SET
            messageContent = excluded.messageContent,
            groupId = excluded.groupId,
            timestamp = excluded.timestamp,
            senderId = excluded.senderId,
            senderGroupNickname = excluded.senderGroupNickname,
            senderNickname = excluded.senderNickname,
            quotedMsgId = excluded.quotedMsgId,
            quotedMsgContent = excluded.quotedMsgContent
    `.trim();

        // 开始事务
        await activeDB.run("BEGIN IMMEDIATE TRANSACTION");

        try {
            for (let i = 0; i < messages.length; i += batchSize) {
                const batch = messages.slice(i, i + batchSize);

                // 动态生成当前批次的SQL（处理最后一批不足batchSize的情况）
                const currentBatchSize = batch.length;
                const sql =
                    currentBatchSize === batchSize
                        ? baseSql
                        : baseSql.replace(
                              Array(batchSize).fill("(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", "),
                              Array(currentBatchSize).fill("(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")
                          );

                // 收集参数
                const params: any[] = [];
                batch.forEach(msg => {
                    params.push(
                        msg.msgId,
                        msg.messageContent,
                        msg.groupId,
                        msg.timestamp,
                        msg.senderId,
                        msg.senderGroupNickname,
                        msg.senderNickname,
                        msg.quotedMsgId,
                        msg.quotedMsgContent
                    );
                });

                // 执行批量插入
                await activeDB.run(sql, params);
            }

            // 提交事务
            await activeDB.run("COMMIT");
        } catch (err) {
            // 出错时回滚
            await activeDB.run("ROLLBACK");
            this.LOGGER.error(`Failed to store messages batch: ${err.message}`);
            throw new Error(`Failed to store messages batch: ${err.message}`);
        }
    }

    /**
     * 获取指定群组在指定时间范围内的所有消息
     * @param groupId 群组ID
     * @param timeStart 起始时间戳
     * @param timeEnd 结束时间戳
     * @returns 消息列表 ！！！已经按照时间从早到晚排序
     */
    public async getRawChatMessagesByGroupIdAndTimeRange(
        groupId: string,
        timeStart: number,
        timeEnd: number
    ): Promise<RawChatMessage[]> {
        const results = await this.db.all<RawChatMessage>(
            `SELECT * FROM chat_messages WHERE groupId = ? AND (timestamp BETWEEN ? AND ?)`,
            [groupId, timeStart, timeEnd]
        );
        // 按照时间从早到晚排序
        results.sort((a, b) => a.timestamp - b.timestamp);
        return results;
    }

    /**
     * 获取指定群组在指定时间范围内的所有消息，包含预处理后的消息
     * @param groupId 群组ID
     * @param timeStart 起始时间戳
     * @param timeEnd 结束时间戳
     * @returns 消息列表 ！！！已经按照时间从早到晚排序
     */
    public async getProcessedChatMessageWithRawMessageByGroupIdAndTimeRange(
        groupId: string,
        timeStart: number,
        timeEnd: number
    ): Promise<ProcessedChatMessageWithRawMessage[]> {
        const results = await this.db.all<ProcessedChatMessageWithRawMessage>(
            `SELECT * FROM chat_messages WHERE groupId = ? AND (timestamp BETWEEN ? AND ?)`,
            [groupId, timeStart, timeEnd]
        );
        // 按照时间从早到晚排序
        results.sort((a, b) => a.timestamp - b.timestamp);
        return results;
    }

    public async getSessionIdsByGroupIdAndTimeRange(
        groupId: string,
        timeStart: number,
        timeEnd: number
    ): Promise<string[]> {
        const results = await this.db.all<{ sessionId: string }>(
            `SELECT DISTINCT sessionId FROM chat_messages WHERE groupId =? AND (timestamp BETWEEN? AND?) AND sessionId IS NOT NULL`,
            [groupId, timeStart, timeEnd]
        );
        return results.map(r => r.sessionId);
    }

    /**
     * 获取指定会话的开始和结束时间
     * @param sessionId 会话ID
     * @returns 时间戳对象 { timeStart: 开始时间, timeEnd: 结束时间 } 或者 null 如果会话不存在
     */
    public async getSessionTimeDuration(
        sessionId: string
    ): Promise<{ timeStart: number; timeEnd: number } | null> {
        const results = await this.db.all<{ timeStart: number | null; timeEnd: number | null }>(
            `SELECT MIN(timestamp) AS timeStart, MAX(timestamp) AS timeEnd FROM chat_messages WHERE sessionId = ?`,
            [sessionId]
        );

        // 过滤掉全 null 的行
        const validResults = results.filter(r => r.timeStart !== null && r.timeEnd !== null);

        if (validResults.length === 0) {
            return null;
        }

        // 从所有有效结果中取全局 min 和 max
        const timeStart = Math.min(...validResults.map(r => r.timeStart!));
        const timeEnd = Math.max(...validResults.map(r => r.timeEnd!));

        return { timeStart, timeEnd };
    }

    /**
     * 获取指定群组最新的一条已入库消息
     * @param groupId 群组ID
     * @returns 消息对象
     */
    public async getNewestRawChatMessageByGroupId(groupId: string): Promise<RawChatMessage> {
        return await this.db.get<RawChatMessage>(
            `SELECT * FROM chat_messages WHERE groupId =? ORDER BY timestamp DESC LIMIT 1`,
            [groupId]
        );
    }

    /**
     * 根据消息id获取raw消息
     * @param msgId 消息id
     * @returns 消息对象
     */
    public async getRawChatMessageByMsgId(msgId: string): Promise<RawChatMessage> {
        const result = await this.db.get<RawChatMessage>(
            `SELECT * FROM chat_messages WHERE msgId =?`,
            [msgId]
        );
        if (!result) {
            this.LOGGER.warning(`未找到消息id为${msgId}的消息`);
        }
        return result;
    }

    // 获取所有消息，用于数据库迁移、导出、备份等操作
    public async selectAll(): Promise<ProcessedChatMessageWithRawMessage[]> {
        return this.db.all<ProcessedChatMessageWithRawMessage>(`SELECT * FROM chat_messages`);
    }

    public execQuerySQL(sql: string, params: any[] = []): Promise<any[]> {
        return this.db.all(sql, params);
    }

    public async storeProcessedChatMessage(message: ProcessedChatMessage) {
        // 执行这个函数的时候，数据库内已经通过storeRawChatMessage函数存储了原始消息，这里只需要更新原记录中的sessionId和preProcessedContent字段即可
        await this.db.run(
            `UPDATE chat_messages SET sessionId = ?, preProcessedContent = ? WHERE msgId = ?`,
            [message.sessionId, message.preProcessedContent, message.msgId]
        );
    }

    public async storeProcessedChatMessages(messages: ProcessedChatMessage[]) {
        if (messages.length === 0) return;

        // 获取当前活跃数据库连接（连接复用）
        const activeDB = await this.db.getActiveDB();

        await activeDB.run("BEGIN IMMEDIATE TRANSACTION");
        try {
            for (const msg of messages) {
                await activeDB.run(
                    `UPDATE chat_messages SET sessionId = ?, preProcessedContent = ? WHERE msgId = ?`,
                    [msg.sessionId, msg.preProcessedContent, msg.msgId]
                );
            }
            await activeDB.run("COMMIT");
        } catch (err) {
            await activeDB.run("ROLLBACK");
            throw err;
        }
    }
}
