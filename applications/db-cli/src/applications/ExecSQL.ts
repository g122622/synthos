import { Disposable } from "@root/common/util/lifecycle/Disposable";
import { mustInitBeforeUse } from "@root/common/util/lifecycle/mustInitBeforeUse";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import ConsoleInputService from "@root/common/services/console/ConsoleInputService";
import Logger from "@root/common/util/Logger";

import { IApplication } from "@/contracts/IApplication";

@mustInitBeforeUse
export class ExecSQL extends Disposable implements IApplication {
    public static readonly appName = "执行SQL";
    public static readonly description = "交互式执行SQL语句（输入 e 退出）";

    LOGGER = Logger.withTag("执行SQL");

    public async init() {}

    public async run() {
        const imDbAccessService = new ImDbAccessService();

        await imDbAccessService.init();

        while (true) {
            const sql = await ConsoleInputService.readEntireLine("请输入SQL语句：");

            try {
                if (sql.trim().toLowerCase() === "e") {
                    break;
                }
                const res = await imDbAccessService.execQuerySQL(sql);

                this.LOGGER.info(`执行结果：${JSON.stringify(res, null, 2)}`);
            } catch (e) {
                this.LOGGER.error(`执行SQL时出错：${e}`);
            }
        }
    }
}
