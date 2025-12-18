import Logger from "@root/common/util/Logger";
import { applications } from "./applications/index";
import { select } from "@inquirer/prompts";
import { IApplicationClass } from "./contracts/IApplication";

const LOGGER = Logger.withTag("⛏️ db-cli");
const EXIT_OPTION = "__exit__";

class ConsoleApplicationMain {
    /**
     * 构建 Inquirer 选择列表的选项
     */
    private static buildChoices() {
        const choices: Array<{ name: string; value: IApplicationClass | typeof EXIT_OPTION }> = 
            applications.map((appClass: IApplicationClass) => ({
                name: `${appClass.appName} - ${appClass.description}`,
                value: appClass,
            }));

        // 添加退出选项
        choices.push({
            name: "退出",
            value: EXIT_OPTION,
        });

        return choices;
    }

    /**
     * 显示应用选择菜单
     */
    private static async showMenu(): Promise<IApplicationClass | typeof EXIT_OPTION> {
        const selectedApp = await select({
            message: "请选择要运行的应用：",
            choices: this.buildChoices(),
        });
        return selectedApp;
    }

    /**
     * 运行选中的应用
     */
    private static async runApplication(appClass: IApplicationClass) {
        LOGGER.info(`正在启动应用：${appClass.appName}`);
        const app = new appClass();

        try {
            await app.init();
            await app.run();
        } catch (error) {
            LOGGER.error(`应用运行出错：${error}`);
        } finally {
            try {
                LOGGER.info(`应用 ${appClass.appName} 运行结束，正在清理资源...`);
                await app.dispose();
                LOGGER.info(`应用 ${appClass.appName} 资源清理完成`);
            } catch (disposeError) {
                LOGGER.error(`应用清理资源时出错：${disposeError}`);
            }
        }
    }

    public static async run() {
        LOGGER.info("欢迎使用 db-cli 数据库命令行工具");

        while (true) {
            const selected = await this.showMenu();

            if (selected === EXIT_OPTION) {
                LOGGER.info("再见！");
                break;
            }

            await this.runApplication(selected);
            console.log(); // 输出空行分隔
        }
    }
}

ConsoleApplicationMain.run();
