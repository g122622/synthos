import ConfigManagerService from "@root/common/config/ConfigManagerService";
import { RawChatMessage } from "@root/common/types/data-provider/index";
import { IIMProvider } from "./@types/IIMProvider";
const Database = require("@journeyapps/sqlcipher").verbose().Database;

export class QQProvider implements IIMProvider {
    private db = null;

    public async init() {
        const dbPath = (await ConfigManagerService.getCurrentConfig()).dataProviders.QQ.dbBasePath + "/nt_msg.db";
        // 打开数据库（原地读取，不复制）
        const db = new Database(dbPath, {
            // 必须设置 SQLCipher 选项
            cipher: "sqlcipher",
            key: (await ConfigManagerService.getCurrentConfig()).dataProviders.QQ.dbKey,
            // 可选：如果你知道 SQLCipher 版本（NTQQ 一般用 v4）
            cipher_page_size: 4096,
            kdf_iter: 64000 // SQLCipher v4 默认值
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
