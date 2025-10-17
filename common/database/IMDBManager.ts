import ConfigManagerService from "../config/ConfigManagerService";
import { ProcessedChatMessage, RawChatMessage, ProcessedChatMessageWithRawMessage } from "../types/data-provider/index";
import Logger from "../util/Logger";
import { MultiFileSQLite } from "./MultiFileSQLite";

export class IMDBManager {
    private LOGGER = Logger.withTag("IMDBManager");
    private db: MultiFileSQLite;

    public async init() {
        this.db = new MultiFileSQLite({
            dbBasePath: (await ConfigManagerService.getCurrentConfig()).commonDatabase.dbBasePath,
            maxDBDuration: (await ConfigManagerService.getCurrentConfig()).commonDatabase.maxDBDuration,
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

        // 释放imdbManager
        process.on("SIGINT", async () => {
            console.log("SIGINT received, closing...");
            await this.close();
            process.exit(0);
        });

        this.LOGGER.info("初始化完成！");
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

    public async getRawChatMessagesByGroupIdAndTimeRange(
        groupId: string,
        timeStart: number,
        timeEnd: number
    ): Promise<RawChatMessage[]> {
        const results = (await this.db.all(`SELECT * FROM chat_messages WHERE groupId = ? AND (timestamp BETWEEN ? AND ?)`, [
            groupId,
            timeStart,
            timeEnd
        ])) as RawChatMessage[];
        return results;
    }

    public async getProcessedChatMessageWithRawMessageByGroupIdAndTimeRange(
        groupId: string,
        timeStart: number,
        timeEnd: number
    ): Promise<ProcessedChatMessageWithRawMessage[]> {
        const results = (await this.db.all(`SELECT * FROM chat_messages WHERE groupId = ? AND (timestamp BETWEEN ? AND ?)`, [
            groupId,
            timeStart,
            timeEnd
        ])) as ProcessedChatMessageWithRawMessage[];
        return results;
    }

    public async storeProcessedChatMessage(message: ProcessedChatMessage) {
        // 执行这个函数的时候，数据库内已经通过storeRawChatMessage函数存储了原始消息，这里只需要更新原记录中的sessionId和preProcessedContent字段即可
        await this.db.run(`UPDATE chat_messages SET sessionId = ?, preProcessedContent = ? WHERE msgId = ?`, [
            message.sessionId,
            message.preProcessedContent,
            message.msgId
        ]);
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
