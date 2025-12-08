import "reflect-metadata";
import { readFile } from "fs/promises";
import { injectable } from "tsyringe";
import { GlobalConfig } from "./@types/GlobalConfig";
import { findFileUpwards } from "../util/file/findFileUpwards";
import { ASSERT } from "../util/ASSERT";

@injectable()
class ConfigManagerService {
    private configPath: Promise<string>;

    constructor(configPath?: string) {
        if (configPath) {
            this.configPath = Promise.resolve(configPath);
        } else {
            // 从当前目录开始逐层向上层查找synthos_config.json文件
            const absolutePath = findFileUpwards("synthos_config.json");
            this.configPath = absolutePath;
        }
    }

    public async getCurrentConfig(): Promise<GlobalConfig> {
        const configPath = await this.configPath;
        ASSERT(configPath, "未找到配置文件");
        const configContent = await readFile(configPath, "utf8");
        return JSON.parse(configContent) as GlobalConfig;
    }
}

const instance = new ConfigManagerService();

export default instance;
