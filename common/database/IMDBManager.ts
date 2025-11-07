import ConfigManagerService from "../config/ConfigManagerService";
import {
    ProcessedChatMessage,
    RawChatMessage,
    ProcessedChatMessageWithRawMessage
} from "../types/data-provider/index";
import Logger from "../util/Logger";
import { MultiFileSQLite } from "./MultiFileSQLite";

export class IMDBManager {
    private LOGGER = Logger.withTag("IMDBManager");
    private db: MultiFileSQLite;

    public async init() {
        this.db = new MultiFileSQLite({
            dbBasePath: (await ConfigManagerService.getCurrentConfig()).commonDatabase.dbBasePath,
            maxDBDuration: (await ConfigManagerService.getCurrentConfig()).commonDatabase
                .maxDBDuration,
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
                    sessionId TEXT,
                    preProcessedContent TEXT
                );`
        });
    }

    public async storeRawChatMessage(msg: RawChatMessage) {
        await this.db.run(
            `INSERT INTO chat_messages (
                msgId, messageContent, groupId, timestamp, senderId, senderGroupNickname, senderNickname, quotedMsgId
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(msgId) DO UPDATE SET
                messageContent = excluded.messageContent,
                groupId = excluded.groupId,
                timestamp = excluded.timestamp,
                senderId = excluded.senderId,
                senderGroupNickname = excluded.senderGroupNickname,
                senderNickname = excluded.senderNickname,
                quotedMsgId = excluded.quotedMsgId`,
            [
                msg.msgId,
                msg.messageContent,
                msg.groupId,
                msg.timestamp,
                msg.senderId,
                msg.senderGroupNickname,
                msg.senderNickname,
                msg.quotedMsgId
            ]
        );
    }

    public async storeRawChatMessages(messages: RawChatMessage[]) {
        for (const msg of messages) {
            await this.storeRawChatMessage(msg);
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

    public async storeProcessedChatMessage(message: ProcessedChatMessage) {
        // 执行这个函数的时候，数据库内已经通过storeRawChatMessage函数存储了原始消息，这里只需要更新原记录中的sessionId和preProcessedContent字段即可
        await this.db.run(
            `UPDATE chat_messages SET sessionId = ?, preProcessedContent = ? WHERE msgId = ?`,
            [message.sessionId, message.preProcessedContent, message.msgId]
        );
    }

    public async storeProcessedChatMessages(messages: ProcessedChatMessage[]) {
        for (const msg of messages) {
            await this.storeProcessedChatMessage(msg);
        }
    }

    public async close() {
        await this.db.close();
    }
}
