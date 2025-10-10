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
        // 1. 创建一个临时内存数据库（仅用于加载扩展）
        const tempDb = new PromisifiedSQLite(sqlite3);
        await tempDb.open(":memory:"); // 内存数据库，瞬间打开
        // 2. 通过这个临时连接加载扩展 → 全局注册 offset_vfs
        await tempDb.loadExtension("Z:/sqlite_ext_ntqq_db.dll");
        // 3. 关闭临时数据库（可选）
        await tempDb.close(); // 你需要在 PromisifiedSQLite 中实现 close()

        const dbPath = (await ConfigManagerService.getCurrentConfig()).dataProviders.QQ.dbBasePath + "/nt_msg.db";
        // 打开QQNT数据库（原地读取，不复制）
        // @see https://docs.aaqwq.top/decrypt/decode_db.html#%E9%80%9A%E7%94%A8%E9%85%8D%E7%BD%AE%E9%80%89%E9%A1%B9
        const db = new PromisifiedSQLite(sqlite3);
        await db.open(dbPath);
        this.db = db;

        // 加密相关配置
        Logger.info(`[QQProvider] 当前的dbKey: ${(await ConfigManagerService.getCurrentConfig()).dataProviders.QQ.dbKey}`);
        await db.exec(`
            PRAGMA key = '${(await ConfigManagerService.getCurrentConfig()).dataProviders.QQ.dbKey}';
            PRAGMA cipher_compatibility = 4;
            PRAGMA cipher_page_size = 4096;
            PRAGMA kdf_iter = 4000;
            PRAGMA cipher_hmac_algorithm = HMAC_SHA1;
            PRAGMA cipher_kdf_algorithm = PBKDF2_HMAC_SHA512;
            PRAGMA cipher = 'aes-256-cbc';
        `);

        // 尝试读取数据库表数量，看看解密是否成功
        const sql = `SELECT count(*) FROM sqlite_master`;
        const stmt = await db.prepare(sql);
        const result = await stmt.get();
        Logger.success(`[QQProvider] 解密成功，数据库表数量: ${result["count(*)"]}`);
        await stmt.finalize();
        Logger.success("[QQProvider] 初始化完成！");

        // 列出所有表名
        const tables = await db.all(`SELECT name FROM sqlite_master WHERE type='table'`);
        Logger.info("[QQProvider] 数据库表名:");
        tables.forEach(table => {
            Logger.info(`[QQProvider] - ${table.name}`);
        });
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
