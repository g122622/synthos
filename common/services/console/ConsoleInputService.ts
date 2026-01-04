import * as readline from "readline";
import Logger from "../../util/Logger";
import { Disposable } from "../../util/lifecycle/Disposable";

/**
 * 控制台交互管理类，用于处理控制台的输入
 */
class ConsoleInputService extends Disposable {
    // 使用readline模块创建接口实例
    private rl: readline.Interface;
    private LOGGER = Logger.withTag("ConsoleInputService");

    constructor() {
        super();
        // 初始化readline实例，绑定标准输入输出流
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        // 注册Disposable函数，用于在实例销毁时关闭readline接口
        this._registerDisposableFunction(() => {
            this.rl.close(); // 关闭readline接口
        });
    }

    /**
     * 异步读取用户输入，并自动处理逗号分隔符
     * @param prompt 展示给用户的输入提示信息
     * @returns 返回处理后的字符串数组，自动去除首尾空格和空值
     */
    public async readEntireLineInputDividedByComma(prompt: string): Promise<string[]> {
        // 通过Promise封装readline.question方法实现异步输入
        const input: string = await new Promise(resolve => {
            this.rl.question(prompt, answer => resolve(answer));
        });

        // 处理逗号分隔逻辑：分割（TODO：也要考虑中文逗号）、去除首尾空格、过滤空字符串
        return input
            .split(new RegExp("[,，]", "g"))
            .map(item => item.trim())
            .filter(item => item.length > 0);
    }

    public async readEntireLine(prompt: string): Promise<string> {
        const input: string = await new Promise(resolve => {
            this.rl.question(prompt, answer => resolve(answer));
        });
        return input;
    }

    /**
     * 读取用户输入的数字
     * @param prompt 展示给用户的输入提示信息
     * @returns 返回数字类型的输入
     */
    public async readInputNumber(prompt: string): Promise<number> {
        const input: string = await new Promise(resolve => {
            this.rl.question(prompt, answer => resolve(answer));
        });
        return Number(input);
    }

    /**
     * 询问用户是否同意
     * @param prompt
     * @returns
     */
    public async yesOrNo(prompt: string): Promise<boolean> {
        let input: string = await new Promise(resolve => {
            this.rl.question(prompt + "(y/n)", answer => resolve(answer));
        });
        input = input.toLowerCase();
        if (input === "y" || input === "yes") {
            return true;
        } else if (input === "n" || input === "no") {
            return false;
        } else {
            this.LOGGER.error("请输入y或n!");
            return await this.yesOrNo(prompt);
        }
    }
}

// 导出默认实例（根据场景也可导出类）
export default new ConsoleInputService();
