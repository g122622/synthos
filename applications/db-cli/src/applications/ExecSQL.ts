import { Disposable } from "@root/common/util/lifecycle/Disposable";
import { IApplication } from "@/contracts/IApplication";
import { mustInitBeforeUse } from "@root/common/util/lifecycle/mustInitBeforeUse";
import { IMDBManager } from "@root/common/database/IMDBManager";
import ConsoleInputService from "@root/common/util/ConsoleInputService";
import Logger from "@root/common/util/Logger";

@mustInitBeforeUse
export class ExecSQL extends Disposable implements IApplication {
    public static readonly appName = "执行SQL";
    public static readonly description = "交互式执行SQL语句（输入 e 退出）";

    LOGGER = Logger.withTag("执行SQL");

    public async init() {
    }

    public async run() {
        const imdbManager = new IMDBManager();
        await imdbManager.init();

        while (true) {
            const sql = await ConsoleInputService.readEntireLine("请输入SQL语句：");
            try {
                if (sql.trim().toLowerCase() === "e") {
                    break;
                }
                const res = await imdbManager.execQuerySQL(sql);
                this.LOGGER.info(`执行结果：${JSON.stringify(res, null, 2)}`);
            } catch (e) {
                this.LOGGER.error(`执行SQL时出错：${e}`);
            }
        }
    }

}