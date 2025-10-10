import ConfigManagerService from "@root/common/config/ConfigManagerService";
import { RawChatMessage } from "@root/common/types/data-provider/index";
import { IIMProvider } from "../@types/IIMProvider";
import Logger from "@root/common/util/Logger";
import { PromisifiedSQLite } from "@root/common/util/promisify/PromisifiedSQLite";
import { sleep } from "@root/common/util/promisify/sleep";
import { ASSERT } from "@root/common/util/ASSERT";
import ErrorReasons from "@root/common/types/ErrorReasons";
import { parseMsgContentFromPB } from "./utils/parseMsgContentFromPB";
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
            const testSql = `SELECT * FROM group_msg_table WHERE "40050" between ${timeStart} and ${timeEnd}`;
            this.LOGGER.info(`执行的SQL: ${testSql}`);
            const results = await this.db.all(testSql);
            this.LOGGER.info(`测试结果数量: ${results.length}`);
            for (const result of results) {
                this.LOGGER.info(`原结果: ${result["40800"]}`);
                this.LOGGER.info(`parse后结果: ${parseMsgContentFromPB(result["40800"])}`);
            }
            return [];
        } else {
            throw ErrorReasons.UNINITIALIZED_ERROR;
        }
    }

    public async close() {
        if (this.db) {
            await this.db.close();
        }
    }
}
