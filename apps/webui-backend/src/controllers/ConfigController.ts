/**
 * 配置控制器
 * 处理配置相关的 HTTP 请求
 */
import { Request, Response } from "express";
import { injectable, inject } from "tsyringe";
import { TOKENS } from "../di/tokens";
import { ConfigService } from "../services/ConfigService";

@injectable()
export class ConfigController {
    constructor(
        @inject(TOKENS.ConfigService) private configService: ConfigService
    ) {}

    /**
     * GET /api/config/schema
     * 获取配置的 JSON Schema
     */
    getConfigSchema(_req: Request, res: Response): void {
        const schema = this.configService.getConfigSchema();
        res.json({ success: true, data: schema });
    }

    /**
     * GET /api/config/current
     * 获取当前合并后的配置
     */
    async getCurrentConfig(_req: Request, res: Response): Promise<void> {
        const config = await this.configService.getCurrentConfig();
        res.json({ success: true, data: config });
    }

    /**
     * GET /api/config/base
     * 获取基础配置（不含 override）
     */
    async getBaseConfig(_req: Request, res: Response): Promise<void> {
        const config = await this.configService.getBaseConfig();
        if (config === null) {
            res.status(404).json({ success: false, error: "基础配置文件不存在" });
            return;
        }
        res.json({ success: true, data: config });
    }

    /**
     * GET /api/config/override
     * 获取 override 配置
     */
    async getOverrideConfig(_req: Request, res: Response): Promise<void> {
        const config = await this.configService.getOverrideConfig();
        // override 配置可能不存在，返回空对象
        res.json({ success: true, data: config ?? {} });
    }

    /**
     * POST /api/config/override
     * 保存 override 配置
     */
    async saveOverrideConfig(req: Request, res: Response): Promise<void> {
        const config = req.body;

        // 验证配置格式
        const validationResult = this.configService.validatePartialConfig(config);
        if (!validationResult.success) {
            // TODO 复用src/errors下的公共错误
            res.status(400).json({
                success: false,
                error: "配置验证失败",
                details: validationResult.errors
            });
            return;
        }

        await this.configService.saveOverrideConfig(config);
        res.json({
            success: true,
            message: "配置保存成功，请手动重启服务以使配置生效"
        });
    }

    /**
     * POST /api/config/validate
     * 验证配置
     */
    validateConfig(req: Request, res: Response): void {
        const { config, partial = false } = req.body;

        const validationResult = partial
            ? this.configService.validatePartialConfig(config)
            : this.configService.validateConfig(config);

        if (validationResult.success) {
            res.json({ success: true, valid: true });
        } else {
            res.json({
                success: true,
                valid: false,
                errors: validationResult.errors
            });
        }
    }
}
