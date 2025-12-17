import ConsoleInputService from "@root/common/util/ConsoleInputService";
import { getConfigManagerService } from "@root/common/di/container";
import Logger from "@root/common/util/Logger";
import { IMDBManager } from "@root/common/database/IMDBManager";

const LOGGER = Logger.withTag("⛏️ db-cli");
const configManagerService = getConfigManagerService();

(async () => {
    const imdbManager = new IMDBManager();
    await imdbManager.init();
    const config = await configManagerService.getCurrentConfig();

    console.log("当前配置：");
    console.dir(config, { depth: 10 });
    console.log(JSON.stringify(config, null, 4))

    while (true) {
        const sql = await ConsoleInputService.readEntireLine("请输入SQL语句：");
        try {
            const res = await imdbManager.execQuerySQL(sql);
            LOGGER.info(`执行结果：${JSON.stringify(res, null, 2)}`);
        } catch (e) {
            LOGGER.error(`执行SQL时出错：${e}`);
        }
    }
})();
