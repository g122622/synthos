import ConfigManagerService from "@root/common/config/ConfigManagerService";
import { RawChatMessage } from "@root/common/types/data-provider/index";
import { IIMProvider } from "./@types/IIMProvider";
const Database = require("@journeyapps/sqlcipher").verbose().Database;

export class QQProvider implements IIMProvider {
    private db: typeof Database;

    public async init() {
        const dbPath = (await ConfigManagerService.getCurrentConfig()).dataProviders.QQ.dbBasePath + "/nt_msg.db";
        // 打开数据库（原地读取，不复制）
        // @see https://docs.aaqwq.top/decrypt/decode_db.html#%E9%80%9A%E7%94%A8%E9%85%8D%E7%BD%AE%E9%80%89%E9%A1%B9
        const db = new Database(dbPath, {
            cipher: "aes-256-cbc",
            key: (await ConfigManagerService.getCurrentConfig()).dataProviders.QQ.dbKey,
            cipher_page_size: 4096,
            kdf_iter: 4000, // 非默认值
            cipher_hmac_algorithm: "HMAC_SHA1", // 非默认值
            cipher_default_kdf_algorithm: "PBKDF2_HMAC_SHA512" // 非默认值
        });
        this.db = db;
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
