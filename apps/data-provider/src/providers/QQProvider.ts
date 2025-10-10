import ConfigManagerService from "@root/common/config/ConfigManagerService";
import { RawChatMessage } from "@root/common/types/data-provider/index";
import { IIMProvider } from "./@types/IIMProvider";
import Logger from "@root/common/util/Logger";
import { PromisifiedSQLite } from "@root/common/util/promisify/PromisifiedSQLite";
import { sleep } from "@root/common/util/promisify/sleep";
const sqlite3 = require("@journeyapps/sqlcipher").verbose();

export class QQProvider implements IIMProvider {
    private db: PromisifiedSQLite | null = null;

    public async init() {
        const dbPath = (await ConfigManagerService.getCurrentConfig()).dataProviders.QQ.dbBasePath + "/nt_msg.db";
        // 打开数据库（原地读取，不复制）
        // @see https://docs.aaqwq.top/decrypt/decode_db.html#%E9%80%9A%E7%94%A8%E9%85%8D%E7%BD%AE%E9%80%89%E9%A1%B9
        const db = new PromisifiedSQLite(sqlite3);
        await db.open(dbPath);
        this.db = db;
        await db.loadExtension("Z:/sqlite_ext_ntqq_db.dll");

        // 加密相关配置
        Logger.info(`[QQProvider] 当前的dbKey: ${(await ConfigManagerService.getCurrentConfig()).dataProviders.QQ.dbKey}`);
        await db.run("PRAGMA cipher_compatibility = 4"); // 设置 SQLCipher 兼容模式（推荐显式指定）。对应 SQLCipher 4.x
        await db.run("PRAGMA key = '" + (await ConfigManagerService.getCurrentConfig()).dataProviders.QQ.dbKey + "'");
        await db.run("PRAGMA cipher_page_size = 4096"); // 非默认值
        await db.run("PRAGMA kdf_iter = 4000"); // 非默认值
        await db.run("PRAGMA cipher_hmac_algorithm = PBKDF2_HMAC_SHA512"); // 非默认值
        await db.run("PRAGMA cipher_default_kdf_algorithm = PBKDF2_HMAC_SHA512"); // 非默认值
        await db.run("PRAGMA cipher = 'aes-256-cbc'"); // 非默认值

        // 尝试读取数据库，看看有哪些表
        // const tables = await this.db.all("SELECT name FROM sqlite_master WHERE type='table'");
        // const stmt = await db.prepare("SELECT name FROM sqlite_master WHERE type='table'");
        const stmt = await db.prepare("SELECT * FROM group_msg_table WHERE 40093='古'");
        const tables = [] as string[];
        stmt.each((err: any, row: any) => {
            if (err) {
                Logger.error("Failed to read table: " + err.message);
            } else {
                tables.push(row.name);
            }
        });
        stmt.finalize();
        Logger.info("QQProvider init done");
        Logger.info("QQProvider tables: " + tables);
        console.dir(tables);
    }

    public async getMsgByTimeRange(timeStart: number, timeEnd: number): Promise<RawChatMessage[]> {
        throw new Error("Method not implemented.");
    }

    public async close() {
        if (this.db) {
            this.db.close();
        }
    }
}
