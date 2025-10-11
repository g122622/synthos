import ConfigManagerService from "@root/common/config/ConfigManagerService";
import { RawChatMessage } from "@root/common/types/data-provider/index";
import { IIMProvider } from "../@types/IIMProvider";
import Logger from "@root/common/util/Logger";
import { PromisifiedSQLite } from "@root/common/util/promisify/PromisifiedSQLite";
import ErrorReasons from "@root/common/types/ErrorReasons";
import { parseMsgContentFromPB } from "./utils/parseMsgContentFromPB";
import { GroupMsgColumn as GMC } from "./@types/mappers/GroupMsgColumn";
import { ASSERT } from "@root/common/util/ASSERT";
import { RawGroupMsgFromDB } from "./@types/RawGroupMsgFromDB";
const sqlite3 = require("@journeyapps/sqlcipher").verbose();

export class QQProvider implements IIMProvider {
    private db: PromisifiedSQLite | null = null;
    private LOGGER = Logger.withTag("QQProvider");

    public async init() {
        // 1. 创建一个临时内存数据库（仅用于加载扩展）
        const tempDb = new PromisifiedSQLite(sqlite3);
        await tempDb.open(":memory:"); // 内存数据库，瞬间打开
        // 2. 通过这个临时连接加载扩展 → 全局注册 offset_vfs
        await tempDb.loadExtension("Z:/sqlite_ext_ntqq_db.dll");
        // 3. 关闭临时数据库
        await tempDb.close();

        const dbPath = (await ConfigManagerService.getCurrentConfig()).dataProviders.QQ.dbBasePath + "/nt_msg.db";
        // 打开QQNT数据库（原地读取，不复制）
        // @see https://docs.aaqwq.top/decrypt/decode_db.html#%E9%80%9A%E7%94%A8%E9%85%8D%E7%BD%AE%E9%80%89%E9%A1%B9
        const db = new PromisifiedSQLite(sqlite3);
        await db.open(dbPath);
        this.db = db;

        // 加密相关配置
        this.LOGGER.info(`当前的dbKey: ${(await ConfigManagerService.getCurrentConfig()).dataProviders.QQ.dbKey}`);
        await db.exec(`
            PRAGMA key = '${(await ConfigManagerService.getCurrentConfig()).dataProviders.QQ.dbKey}';
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
        this.LOGGER.success("初始化完成！");
    }

    /**
     * 获取数据库补丁SQL
     * @returns 数据库补丁SQL
     */
    private async getPatchSQL() {
        const patchSQL = (await ConfigManagerService.getCurrentConfig()).dataProviders.QQ.dbPatch.enabled
            ? `(${(await ConfigManagerService.getCurrentConfig()).dataProviders.QQ.dbPatch.patchSQL})`
            : "";
        return patchSQL;
    }

    /**
     * 从QQNT数据库中获取指定时间范围内的消息
     * @param timeStart 开始时间（毫秒级时间戳）
     * @param timeEnd 结束时间（毫秒级时间戳）
     * @returns 消息数组
     */
    public async getMsgByTimeRange(timeStart: number, timeEnd: number): Promise<RawChatMessage[]> {
        if (this.db) {
            // 转换为秒级时间戳
            timeStart = Math.floor(timeStart / 1000);
            timeEnd = Math.ceil(timeEnd / 1000);
            // 生成SQL语句
            const sql = `SELECT * FROM group_msg_table WHERE ${await this.getPatchSQL()} and "${GMC.msgTime}" between ${timeStart} and ${timeEnd} `;
            this.LOGGER.debug(`执行的SQL: ${sql}`);
            const results = await this.db.all(sql);
            this.LOGGER.debug(`结果数量: ${results.length}`);
            for (const result of results) {
                this.LOGGER.info(`原结果: ${result[GMC.msgContent]}`);
                this.LOGGER.yellow(`parse后结果: ${parseMsgContentFromPB(result[GMC.msgContent])}`);
            }
            return [];
        } else {
            throw ErrorReasons.UNINITIALIZED_ERROR;
        }
    }

    /**
     * 根据群号（40030）和消息序号（40003）获取消息
     * @returns 消息数组
     */
    private async getMsgByGroupNumberAndMsgSeq(groupNumber: number, msgSeq: number): Promise<RawGroupMsgFromDB | null> {
        if (this.db) {
            // 生成SQL语句
            const sql = `SELECT * FROM group_msg_table WHERE ${await this.getPatchSQL()} and "${GMC.groupUin}" = ${groupNumber} and "${GMC.msgSeq}" = ${msgSeq}`;
            this.LOGGER.debug(`执行的SQL: ${sql}`);
            const results = await this.db.all(sql);
            this.LOGGER.debug(`结果数量: ${results.length}`);
            ASSERT(results.length <= 1);
            if (results.length === 0) {
                return null;
            } else {
                return results[0];
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
    private async getMsgByMsgId(msgId: string): Promise<RawGroupMsgFromDB | null> {
        if (this.db) {
            // 生成SQL语句
            const sql = `SELECT * FROM group_msg_table WHERE ${await this.getPatchSQL()} and "${GMC.msgId}" = ${msgId}`;
            this.LOGGER.debug(`执行的SQL: ${sql}`);
            const results = await this.db.all(sql);
            this.LOGGER.debug(`结果数量: ${results.length}`);
            ASSERT(results.length <= 1);
            if (results.length === 0) {
                return null;
            }
            return results[0];
        } else {
            throw ErrorReasons.UNINITIALIZED_ERROR;
        }
    }

    public async test() {
        const foo = await this.getMsgByMsgId("7559628700204540816");
        // parse
        if (foo) {
            const bar = parseMsgContentFromPB(foo[GMC.msgContent]);
            console.log(bar);
        }
        if (foo) {
            const bar = await this.getMsgByGroupNumberAndMsgSeq(foo[GMC.groupUin], foo[GMC.replyMsgSeq]);
            console.dir(bar);
            if (bar) {
                const baz = parseMsgContentFromPB(bar[GMC.msgContent]);
                console.log(baz);
            }
        }
    }

    public async close() {
        if (this.db) {
            await this.db.close();
        }
    }
}
