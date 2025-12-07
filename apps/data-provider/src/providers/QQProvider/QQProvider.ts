import ConfigManagerService from "@root/common/config/ConfigManagerService";
import { RawChatMessage } from "@root/common/contracts/data-provider/index";
import { IIMProvider } from "../contracts/IIMProvider";
import Logger from "@root/common/util/Logger";
import { PromisifiedSQLite } from "@root/common/util/promisify/PromisifiedSQLite";
import ErrorReasons from "@root/common/contracts/ErrorReasons";
import { GroupMsgColumn as GMC } from "./@types/mappers/GroupMsgColumn";
import { ASSERT, ASSERT_NOT_FATAL } from "@root/common/util/ASSERT";
import { RawGroupMsgFromDB } from "./@types/RawGroupMsgFromDB";
import { MessagePBParser } from "./parsers/MessagePBParser";
import { MsgElementType } from "./@types/mappers/MsgElementType";
import { SingleMessage } from "./@types/RawMsgContentParseResult";
import { Disposable } from "@root/common/util/lifecycle/Disposable";
import { mustInitBeforeUse } from "@root/common/util/lifecycle/mustInitBeforeUse";
import sqlite3 from "@journeyapps/sqlcipher";
sqlite3.verbose();

@mustInitBeforeUse
export class QQProvider extends Disposable implements IIMProvider {
    private db: PromisifiedSQLite | null = null;
    private LOGGER = Logger.withTag("QQProvider");
    private messagePBParser = this._registerDisposable(new MessagePBParser());

    public async init() {
        const config = (await ConfigManagerService.getCurrentConfig()).dataProviders.QQ;
        // 1. 创建一个临时内存数据库（仅用于加载扩展）
        const tempDb = new PromisifiedSQLite(sqlite3);
        await tempDb.open(":memory:"); // 内存数据库，瞬间打开
        // 2. 通过这个临时连接加载扩展 → 全局注册 offset_vfs
        await tempDb.loadExtension(config.VFSExtPath);
        // 3. 关闭临时数据库
        await tempDb.dispose();

        const dbPath = config.dbBasePath + "/nt_msg.db";
        // 打开QQNT数据库（原地读取，不复制）
        // @see https://docs.aaqwq.top/decrypt/decode_db.html#%E9%80%9A%E7%94%A8%E9%85%8D%E7%BD%AE%E9%80%89%E9%A1%B9
        const db = new PromisifiedSQLite(sqlite3);
        await db.open(dbPath);
        this.db = this._registerDisposable(db);

        // 加密相关配置
        this.LOGGER.info(`当前的dbKey: ${config.dbKey}`);
        await db.exec(`
            PRAGMA key = '${config.dbKey}';
            PRAGMA cipher_page_size = 4096;
            PRAGMA kdf_iter = 4000;
            PRAGMA cipher_hmac_algorithm = HMAC_SHA1;
            PRAGMA cipher_kdf_algorithm = PBKDF2_HMAC_SHA512;
        `);

        // 尝试读取数据库表数量，看看解密是否成功
        const sql = `SELECT count(*) FROM sqlite_master`;
        const stmt = await db.prepare(sql);
        const result = await stmt.get();
        this.LOGGER.success(`解密成功，数据库表数量: ${result["count(*)"]}`);
        await stmt.finalize();

        // 初始化消息解析器
        await this.messagePBParser.init();

        this.LOGGER.success("初始化完成！");
    }

    /**
     * 获取数据库补丁SQL
     * @returns 数据库补丁SQL
     */
    private async _getPatchSQL() {
        const patchSQL = (await ConfigManagerService.getCurrentConfig()).dataProviders.QQ.dbPatch
            .enabled
            ? `(${(await ConfigManagerService.getCurrentConfig()).dataProviders.QQ.dbPatch.patchSQL})`
            : "";
        return patchSQL;
    }

    private async _parseMessageContent(rawMsgElements: SingleMessage[]): Promise<string> {
        let result = "";
        for (const rawMsgElement of rawMsgElements) {
            switch (rawMsgElement.messageType) {
                case MsgElementType.TEXT: {
                    result += rawMsgElement.messageText;
                    break;
                }
                case MsgElementType.EMOJI: {
                    if (rawMsgElement.emojiText) {
                        result += `[${rawMsgElement.emojiText}]`;
                    }
                    break;
                }
                case MsgElementType.IMAGE: {
                    // TODO: 处理图片消息
                    result += `[图片]`;
                    break;
                }
                case MsgElementType.VOICE: {
                    // TODO: 处理语音消息
                    result += `[语音]`;
                    break;
                }
                case MsgElementType.FILE: {
                    // TODO: 处理文件消息
                    result += `[文件][文件名：${rawMsgElement.fileName}]`;
                    break;
                }
                // TODO: 处理其他消息类型，比如外链、小程序分享、转发的聊天记录等
                default: {
                    // 忽略其他类型的消息，不加入messages
                    this.LOGGER.debug(
                        `未知的element类型: ${rawMsgElement.messageType}，忽略该element。`
                    );
                    break;
                }
            }
        }
        return result;
    }

    /**
     * 从QQNT数据库中获取指定时间范围内的消息
     * @param timeStart 开始时间（毫秒级时间戳）
     * @param timeEnd 结束时间（毫秒级时间戳）
     * @param groupId 群号（可选）
     * @returns 消息数组
     */
    public async getMsgByTimeRange(
        timeStart: number,
        timeEnd: number,
        groupId: string = ""
    ): Promise<RawChatMessage[]> {
        if (this.db) {
            // 转换为秒级时间戳
            timeStart = Math.floor(timeStart / 1000);
            timeEnd = Math.ceil(timeEnd / 1000);
            // 生成SQL语句
            const sql = `
                SELECT 
                    CAST("${GMC.msgId}" AS TEXT) AS "${GMC.msgId}",
                    "${GMC.msgTime}",
                    "${GMC.groupUin}",
                    "${GMC.senderUin}",
                    "${GMC.replyMsgSeq}",
                    "${GMC.msgContent}",
                    "${GMC.sendMemberName}",
                    "${GMC.sendNickName}"
                FROM group_msg_table 
                WHERE ${await this._getPatchSQL()} 
                AND ("${GMC.msgTime}" BETWEEN ${timeStart} AND ${timeEnd})
                ${groupId ? `AND "${GMC.groupUin}" = ${groupId}` : ""}
            `;
            this.LOGGER.debug(`执行的SQL: ${sql}`);
            const results = await this.db.all(sql);
            this.LOGGER.debug(`结果数量: ${results.length}`);

            // 解析查询到的全部消息内容
            const messages: RawChatMessage[] = [];
            for (const result of results) {
                // 获取引用的消息 quotedMsgId
                let quotedMsgId: string | undefined = undefined;
                if (result[GMC.replyMsgSeq]) {
                    quotedMsgId = await this._getMsgIdByGroupNumberAndMsgSeq(
                        result[GMC.groupUin],
                        result[GMC.replyMsgSeq]
                    );
                    if (!quotedMsgId) {
                        this.LOGGER.warning(
                            `无法找到被引用的消息的msgId。本条消息的msgId: ${result[GMC.msgId]}`
                        );
                    }
                }

                // 生成消息对象
                const processedMsg: RawChatMessage = {
                    msgId: String(result[GMC.msgId]),
                    messageContent: "",
                    groupId: String(result[GMC.groupUin]),
                    timestamp: result[GMC.msgTime] * 1000, // 转换为毫秒级时间戳
                    senderId: String(result[GMC.senderUin]),
                    senderGroupNickname: result[GMC.sendMemberName],
                    senderNickname: result[GMC.sendNickName],
                    quotedMsgId
                };

                // 获取消息正文：解析40800中的所有element（或者叫做fragment）
                processedMsg.messageContent = await this._parseMessageContent(
                    this.messagePBParser.parseMessageSegment(result[GMC.msgContent]).messages
                );
                if (processedMsg.messageContent === "") {
                    this.LOGGER.debug(
                        `msgId: ${result[GMC.msgId]}的消息内容为空，忽略该消息。发送者: ${result[GMC.sendMemberName ?? result[GMC.sendNickName]]}`
                    );
                } else {
                    messages.push(processedMsg);
                }
            }
            return messages;
        } else {
            throw ErrorReasons.UNINITIALIZED_ERROR;
        }
    }

    /**
     * 根据群号（40030）和消息序号（40003）获取消息
     * @returns 消息数组
     */
    private async _getMsgIdByGroupNumberAndMsgSeq(
        groupNumber: number,
        msgSeq: number
    ): Promise<string | undefined> {
        if (this.db) {
            const sql = `SELECT CAST("${GMC.msgId}" AS TEXT) AS "${GMC.msgId}",
                            "${GMC.msgContent}"
                         FROM group_msg_table 
                         WHERE ${await this._getPatchSQL()} 
                         AND "${GMC.msgSeq}" = ${msgSeq}
                         AND "${GMC.groupUin}" = ${groupNumber}`;

            this.LOGGER.debug(`执行的SQL: ${sql}`);
            const results = await this.db.all(sql);
            this.LOGGER.debug(`结果数量: ${results.length}`);
            ASSERT_NOT_FATAL(
                results.length <= 1,
                `查询到多条消息，msgSeq: ${msgSeq}, groupNumber: ${groupNumber}，查询结果数: ${results.length}, results: ${JSON.stringify(results)}`
            );
            if (results.length === 0) {
                return undefined;
            } else {
                return results[0][GMC.msgId];
            }
        } else {
            throw ErrorReasons.UNINITIALIZED_ERROR;
        }
    }

    /**
     * 根据消息ID（40001）获取消息
     * @param msgId 消息ID (由于id过长，超过Math.MAX_SAFE_INTEGER，因此使用字符串)
     * @returns 消息数组
     */
    private async _getMsgByMsgId(msgId: string): Promise<RawGroupMsgFromDB | null> {
        if (this.db) {
            // 生成SQL语句
            const sql = `SELECT * FROM group_msg_table WHERE ${await this._getPatchSQL()} and "${GMC.msgId}" = ${msgId}`;
            this.LOGGER.debug(`执行的SQL: ${sql}`);
            const results = await this.db.all(sql);
            this.LOGGER.debug(`结果数量: ${results.length}`);
            ASSERT(
                results.length <= 1,
                `查询到多条消息，查询结果数: ${results.length}, msgId: ${msgId}, results: ${JSON.stringify(results)}`
            );
            if (results.length === 0) {
                return null;
            }
            return results[0];
        } else {
            throw ErrorReasons.UNINITIALIZED_ERROR;
        }
    }
}
