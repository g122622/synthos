/**
 * 配置服务
 * 提供配置的读取、保存和验证功能
 */
import { injectable, inject } from "tsyringe";
import { TOKENS } from "../di/tokens";
import type { IConfigManagerService } from "@root/common/config/ConfigManagerService";
import { GlobalConfig, PartialGlobalConfig } from "@root/common/config/@types/GlobalConfig";
import type { JsonSchema7Type } from "zod-to-json-schema";

@injectable()
export class ConfigService {
    constructor(
        @inject(TOKENS.ConfigManagerService)
        private configManagerService: IConfigManagerService
    ) {}

    /**
     * 获取配置的 JSON Schema
     */
    getConfigSchema(): JsonSchema7Type {
        return this.configManagerService.getConfigJsonSchema();
    }

    /**
     * 获取当前合并后的配置
     */
    async getCurrentConfig(): Promise<GlobalConfig> {
        return this.configManagerService.getCurrentConfig();
    }

    /**
     * 获取基础配置（不含 override）
     */
    async getBaseConfig(): Promise<GlobalConfig | null> {
        return this.configManagerService.getBaseConfig();
    }

    /**
     * 获取 override 配置
     */
    async getOverrideConfig(): Promise<PartialGlobalConfig | null> {
        return this.configManagerService.getOverrideConfig();
    }

    /**
     * 保存 override 配置
     */
    async saveOverrideConfig(config: PartialGlobalConfig): Promise<void> {
        return this.configManagerService.saveOverrideConfig(config);
    }

    /**
     * 验证完整配置
     */
    validateConfig(config: unknown): { success: true } | { success: false; errors: string[] } {
        return this.configManagerService.validateConfig(config);
    }

    /**
     * 验证部分配置
     */
    validatePartialConfig(config: unknown): { success: true } | { success: false; errors: string[] } {
        return this.configManagerService.validatePartialConfig(config);
    }
}
