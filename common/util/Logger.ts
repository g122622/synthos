// logger.ts
import { rainbow, pastel, atlas } from "gradient-string";
import { getCurrentFunctionName } from "./getCurrentFunctionName";
import ConfigManagerService from "../config/ConfigManagerService";

type LogLevel =
    | "info"
    | "success"
    | "warning"
    | "error"
    | "blue"
    | "green"
    | "yellow"
    | "red"
    | "bgRed"
    | "bgGreen"
    | "bgYellow"
    | "bgBlue"
    | "gradientWithPastel"
    | "gradientWithAtlas"
    | "gradientWithRainbow";

class Logger {
    private tag: string | null = null;
    private logLevel: "debug" | "info" | "success" | "warning" | "error" = "info";

    constructor(tag: string | null = null) {
        this.tag = tag;
        ConfigManagerService.getCurrentConfig().then(config => {
            this.logLevel = config.logger.logLevel;
        });
    }

    // 工厂方法：创建带 tag 的新 logger
    public withTag(tag: string): Logger {
        return new Logger(`[${tag}]`);
    }

    private getPrefix(): string {
        const time = this.getTimeString();
        return "🎯 " + (this.tag ? `${time}${this.tag} ` : time) + `[${getCurrentFunctionName()}] `;
    }

    private getTimeString(): string {
        const now = new Date();
        return `[${now.toLocaleTimeString()}::${String(now.getMilliseconds()).padStart(3, "0")}] `;
    }

    // ANSI color log helper
    private logWithColor(colorCode: string, message: string): void {
        console.log(`${colorCode}${this.getPrefix()}${message}\x1b[0m`);
    }

    // Gradient log helper
    private logWithGradient(fn: (msg: string) => string, message: string): void {
        console.log(fn(`${this.getPrefix()}${message}`));
    }

    // --- 颜色方法 ---
    public blue(message: string) {
        this.logWithColor("\x1b[34m", message);
    }
    public green(message: string) {
        this.logWithColor("\x1b[32m", message);
    }
    public yellow(message: string) {
        this.logWithColor("\x1b[33m", message);
    }
    public red(message: string) {
        this.logWithColor("\x1b[31m", message);
    }
    public gray(message: string) {
        this.logWithColor("\x1b[30m", message);
    }

    public bgRed(message: string) {
        this.logWithColor("\x1b[41m", message);
    }
    public bgGreen(message: string) {
        this.logWithColor("\x1b[42m", message);
    }
    public bgYellow(message: string) {
        this.logWithColor("\x1b[43m", message);
    }
    public bgBlue(message: string) {
        this.logWithColor("\x1b[44m", message);
    }

    // --- 语义化方法 ---
    public debug(message: string) {
        if (["debug"].includes(this.logLevel)) {
            this.gray(message);
        }
    }
    public info(message: string) {
        if (["debug", "info"].includes(this.logLevel)) {
            this.blue(message);
        }
    }
    public success(message: string) {
        if (["debug", "info", "success"].includes(this.logLevel)) {
            this.green(message);
        }
    }
    public warning(message: string) {
        if (["debug", "info", "success", "warning"].includes(this.logLevel)) {
            this.yellow(message);
        }
    }
    public error(message: string) {
        if (["debug", "info", "success", "warning", "error"].includes(this.logLevel)) {
            this.red(message);
        }
    }

    // --- 渐变方法 ---
    public gradientWithPastel(message: string) {
        this.logWithGradient(pastel, message);
    }
    public gradientWithAtlas(message: string) {
        this.logWithGradient(atlas, message);
    }
    public gradientWithRainbow(message: string) {
        this.logWithGradient(rainbow, message);
    }
}

// 默认导出一个无 tag 的全局 logger（可用于临时日志）
export default new Logger();
