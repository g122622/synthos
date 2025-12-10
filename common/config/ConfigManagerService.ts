import "reflect-metadata";
import { readFile, access } from "fs/promises";
import { injectable } from "tsyringe";
import { dirname, join } from "path";
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

        // 读取主配置文件
        const configContent = await readFile(configPath, "utf8");
        const config = JSON.parse(configContent) as GlobalConfig;

        // 检查是否存在 override 配置文件
        const overridePath = join(dirname(configPath), "synthos_config_override.json");
        const overrideExists = await access(overridePath).then(() => true).catch(() => false);

        if (overrideExists) {
            const overrideContent = await readFile(overridePath, "utf8");
            const overrideConfig = JSON.parse(overrideContent) as Partial<GlobalConfig>;
            // 深度合并配置，override 中非 undefined 的值优先
            return this.deepMerge(config, overrideConfig);
        }

        return config;
    }

    /**
     * 深度合并两个对象，source 中非 undefined 的值会覆盖 target 中的值
     */
    private deepMerge<T extends object>(target: T, source: Partial<T>): T {
        const result = { ...target };

        for (const key in source) {
            const sourceValue = source[key];
            if (sourceValue === undefined) {
                continue;
            }

            const targetValue = (target as Record<string, unknown>)[key];
            if (
                sourceValue !== null &&
                typeof sourceValue === "object" &&
                !Array.isArray(sourceValue) &&
                targetValue !== null &&
                typeof targetValue === "object" &&
                !Array.isArray(targetValue)
            ) {
                // 递归合并嵌套对象
                (result as Record<string, unknown>)[key] = this.deepMerge(
                    targetValue as object,
                    sourceValue as object
                );
            } else {
                (result as Record<string, unknown>)[key] = sourceValue;
            }
        }

        return result;
    }
}

const instance = new ConfigManagerService();

export { ConfigManagerService };
export default instance;
