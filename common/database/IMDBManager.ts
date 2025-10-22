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
        const results = (await this.db.all(
            `SELECT * FROM chat_messages WHERE groupId = ? AND (timestamp BETWEEN ? AND ?)`,
            [groupId, timeStart, timeEnd]
        )) as RawChatMessage[];
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
        const results = (await this.db.all(
            `SELECT * FROM chat_messages WHERE groupId = ? AND (timestamp BETWEEN ? AND ?)`,
            [groupId, timeStart, timeEnd]
        )) as ProcessedChatMessageWithRawMessage[];
        // 按照时间从早到晚排序
        results.sort((a, b) => a.timestamp - b.timestamp);
        return results;
    }

    public async getSessionIdsByGroupIdAndTimeRange(
        groupId: string,
        timeStart: number,
        timeEnd: number
    ): Promise<string[]> {
        const results = (await this.db.all(
            `SELECT DISTINCT sessionId FROM chat_messages WHERE groupId =? AND (timestamp BETWEEN? AND?) AND sessionId IS NOT NULL`,
            [groupId, timeStart, timeEnd]
        )) as { sessionId: string }[];
        return results.map(r => r.sessionId);
    }

    public async getSessionTimeDuration(
        sessionId: string
    ): Promise<{ timeStart: number; timeEnd: number } | null> {
        const results = (await this.db.all(
            `SELECT MIN(timestamp) AS timeStart, MAX(timestamp) AS timeEnd FROM chat_messages WHERE sessionId = ?`,
            [sessionId]
        )) as { timeStart: number | null; timeEnd: number | null }[];

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
