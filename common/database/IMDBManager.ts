import ConfigManagerService from "../config/ConfigManagerService";
import { RawChatMessage } from "../types/data-provider/index";
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
                    msgId TEXT PRIMARY KEY,
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
        this.LOGGER.info("初始化完成！");
    }

    public async storeRawChatMessage(msg: RawChatMessage) {
        await this.db.run(
            `INSERT INTO chat_messages (
                msgId, messageContent, groupId, timestamp, senderId, senderGroupNickname, senderNickname, quotedMsgId
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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

    public async close() {
        await this.db.close();
    }
}
