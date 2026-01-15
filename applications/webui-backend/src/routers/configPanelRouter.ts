/**
 * 配置面板 API 路由配置
 * 用于轻量级模式，仅加载配置相关功能
 */
import { Express } from "express";
import { container } from "tsyringe";
import { TOKENS } from "../di/tokens";
import { asyncHandler } from "../errors/errorHandler";
import { ConfigController } from "../controllers/ConfigController";

export const setupConfigPanelRoutes = (app: Express): void => {
    // 获取 controller 实例
    const configController = container.resolve<ConfigController>(TOKENS.ConfigController);

    // ==================== 配置管理 ====================
    // 获取配置的 JSON Schema
    app.get(
        "/api/config/schema",
        asyncHandler(async (req, res) => configController.getConfigSchema(req, res))
    );

    // 获取当前合并后的配置
    app.get(
        "/api/config/current",
        asyncHandler((req, res) => configController.getCurrentConfig(req, res))
    );

    // 获取基础配置
    app.get(
        "/api/config/base",
        asyncHandler((req, res) => configController.getBaseConfig(req, res))
    );

    // 保存基础配置
    app.post(
        "/api/config/base",
        asyncHandler((req, res) => configController.saveBaseConfig(req, res))
    );

    // 获取 override 配置
    app.get(
        "/api/config/override",
        asyncHandler((req, res) => configController.getOverrideConfig(req, res))
    );

    // 保存 override 配置
    app.post(
        "/api/config/override",
        asyncHandler((req, res) => configController.saveOverrideConfig(req, res))
    );

    // 验证配置
    app.post(
        "/api/config/validate",
        asyncHandler(async (req, res) => configController.validateConfig(req, res))
    );

    // 健康检查
    // app.get("/health", (_req, res) => {
    //     res.json({
    //         success: true,
    //         message: "配置面板后端服务运行正常",
    //         mode: "config-panel",
    //         timestamp: new Date().toISOString()
    //     });
    // });
};
