import "reflect-metadata";
import { readFile, writeFile, access } from "fs/promises";
import { injectable } from "tsyringe";
import { dirname, join } from "path";
import { GlobalConfig, GlobalConfigSchema, PartialGlobalConfig } from "./@types/GlobalConfig";
import { findFileUpwards } from "../util/file/findFileUpwards";
import { ASSERT } from "../util/ASSERT";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { JsonSchema7Type } from "zod-to-json-schema";

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

    /**
     * 获取配置文件路径
     */
    public async getConfigPath(): Promise<string | null> {
        try {
            return await this.configPath;
        } catch {
            return null;
        }
    }

    /**
     * 获取 override 配置文件路径
     */
    public async getOverridePath(): Promise<string | null> {
        const configPath = await this.getConfigPath();
        if (!configPath) return null;
        return join(dirname(configPath), "synthos_config_override.json");
    }

    /**
     * 获取当前合并后的配置
     */
    public async getCurrentConfig(): Promise<GlobalConfig> {
        const configPath = await this.configPath;
        ASSERT(configPath, "未找到配置文件");

        // 1. 读取主配置
        const configContent = await readFile(configPath, "utf8");
        const baseConfig = JSON.parse(configContent); // 类型为 unknown

        // 2. 读取 override 配置（如果存在）
        const overridePath = join(dirname(configPath), "synthos_config_override.json");
        let overrideConfig = {};
        try {
            await access(overridePath);
            const overrideContent = await readFile(overridePath, "utf8");
            overrideConfig = JSON.parse(overrideContent);
        } catch {
            // override 不存在或读取失败，忽略
        }

        // 3. 合并主配置和 override 配置
        const mergedConfig = this.deepMerge(baseConfig, overrideConfig);

        // 4. 用 Zod 全量 Schema 验证合并后的配置文件是否完整且类型正确
        const parsed = GlobalConfigSchema.safeParse(mergedConfig);
        if (!parsed.success) {
            const errors = parsed.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join("\n");
            throw new Error(`配置文件schema完整性校验失败:\n${errors}`);
        }

        return parsed.data as GlobalConfig;
    }

    /**
     * 获取原始配置（不含 override）
     */
    public async getBaseConfig(): Promise<GlobalConfig | null> {
        const configPath = await this.getConfigPath();
        if (!configPath) return null;

        try {
            const configContent = await readFile(configPath, "utf8");
            return JSON.parse(configContent) as GlobalConfig;
        } catch {
            return null;
        }
    }

    /**
     * 获取 override 配置
     */
    public async getOverrideConfig(): Promise<PartialGlobalConfig | null> {
        const overridePath = await this.getOverridePath();
        if (!overridePath) return null;

        try {
            const overrideContent = await readFile(overridePath, "utf8");
            return JSON.parse(overrideContent) as PartialGlobalConfig;
        } catch {
            return null;
        }
    }

    /**
     * 保存 override 配置
     * @param config 要保存的 override 配置
     */
    public async saveOverrideConfig(config: PartialGlobalConfig): Promise<void> {
        const overridePath = await this.getOverridePath();
        ASSERT(overridePath, "无法确定 override 配置文件路径");

        // 验证配置格式
        const partialSchema = GlobalConfigSchema.deepPartial();
        const validationResult = partialSchema.safeParse(config);
        if (!validationResult.success) {
            throw new Error(`配置验证失败: ${validationResult.error.message}`);
        }

        await writeFile(overridePath, JSON.stringify(config, null, 2), "utf8");
    }

    /**
     * 获取配置的 JSON Schema
     * 用于前端动态生成表单和验证
     */
    public getConfigJsonSchema(): JsonSchema7Type {
        return zodToJsonSchema(GlobalConfigSchema, {
            name: "GlobalConfig",
            $refStrategy: "none", // 展开所有引用，方便前端使用
        });
    }

    /**
     * 验证配置是否有效
     * @param config 要验证的配置
     * @returns 验证结果，成功返回 true，失败返回错误信息
     */
    public validateConfig(config: unknown): { success: true } | { success: false; errors: string[] } {
        const result = GlobalConfigSchema.safeParse(config);
        if (result.success) {
            return { success: true };
        }
        return {
            success: false,
            errors: result.error.errors.map(e => `${e.path.join(".")}: ${e.message}`),
        };
    }

    /**
     * 验证部分配置（override 配置）
     * @param config 要验证的部分配置
     * @returns 验证结果
     */
    public validatePartialConfig(config: unknown): { success: true } | { success: false; errors: string[] } {
        const partialSchema = GlobalConfigSchema.deepPartial();
        const result = partialSchema.safeParse(config);
        if (result.success) {
            return { success: true };
        }
        return {
            success: false,
            errors: result.error.errors.map(e => `${e.path.join(".")}: ${e.message}`),
        };
    }

    /**
     * 深度合并两个对象，source 中非 undefined 的值会覆盖 target 中的值
     */
    private deepMerge<T extends object>(target: T, source: Record<string, unknown>): T {
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
                    sourceValue as Record<string, unknown>
                );
            } else {
                (result as Record<string, unknown>)[key] = sourceValue;
            }
        }

        return result;
    }
}

const instance = new ConfigManagerService();

/**
 * ConfigManagerService 实例类型
 * 用于依赖注入时的类型标注
 */
export type IConfigManagerService = ConfigManagerService;

export { ConfigManagerService };
export default instance;
