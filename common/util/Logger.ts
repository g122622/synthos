// logger.ts
import { rainbow, pastel, atlas } from "gradient-string";
import { getCurrentFunctionName } from "./getCurrentFunctionName";
import ConfigManagerService from "../config/ConfigManagerService";
import { appendFile, mkdir, access } from "fs/promises";
import { join } from "path";

class Logger {
    private tag: string | null = null;
    private logLevel: "debug" | "info" | "success" | "warning" | "error" = "info";
    private logDirectory: string = ""; // 日志目录
    private logBuffer: string[] = []; // 日志缓冲区

    constructor(tag: string | null = null) {
        this.tag = tag;
        ConfigManagerService.getCurrentConfig().then(config => {
            this.logLevel = config.logger.logLevel;
            this.logDirectory = config.logger.logDirectory;
            // 启动定时器，每1秒将缓冲区中的日志写入文件
            setInterval(() => this.flushLogBuffer(), 1000);
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

    private async addLineToLogBuffer(line: string) {
        this.logBuffer.push(line);
    }

    private async flushLogBuffer() {
        if (this.logBuffer.length === 0) return;
        // 使用交换缓冲区策略避免极端并发下日志丢失问题
        const bufferToFlush = [...this.logBuffer]; // 复制当前内容
        this.logBuffer = []; // 立即清空，新日志进新数组
        for (const line of bufferToFlush) {
            const date = new Date();
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0"); // 月份从0开始，所以要加1
            const day = String(date.getDate()).padStart(2, "0");
            const fileName = `${year}-${month}-${day}.log`;
            const filePath = join(this.logDirectory, fileName);
            // 确保目录存在
            try {
                await access(this.logDirectory);
            } catch {
                await mkdir(this.logDirectory, { recursive: true }); // 创建目录（如果不存在）
            }
            // 追加日志到文件
            await appendFile(filePath, line + "\n", "utf8");
        }
        // 清空缓冲区
        this.logBuffer = [];
    }

    // ANSI color log helper
    private logWithColor(colorCode: string, message: string): void {
        // 输出到控制台
        console.log(`${colorCode}${this.getPrefix()}${message}\x1b[0m`);
        // 输出到文件
        this.addLineToLogBuffer(`${this.getPrefix()}${message}`);
    }

    // Gradient log helper
    private logWithGradient(fn: (msg: string) => string, message: string): void {
        // 输出到控制台
        console.log(fn(`${this.getPrefix()}${message}`));
        // 输出到文件
        this.addLineToLogBuffer(`${this.getPrefix()}${message}`);
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
