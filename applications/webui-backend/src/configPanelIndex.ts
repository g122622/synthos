/**
 * 配置面板后端服务入口（轻量级模式）
 * 仅加载配置相关功能，不依赖数据库等其他服务
 */
import "reflect-metadata";
import express, { Express } from "express";
import Logger from "@root/common/util/Logger";

import { registerConfigPanelDependencies, registerConfigManagerService } from "./di/container";
import { setupCorsMiddleware } from "./middleware/corsMiddleware";
import { setupJsonMiddleware } from "./middleware/jsonMiddleware";
import { errorHandler } from "./errors/errorHandler";
import { setupConfigPanelRoutes } from "./routers/configPanelRouter";

const LOGGER = Logger.withTag("ConfigPanel-Backend");

export class ConfigPanelServer {
    private app: Express;
    private port: number = 3002;

    constructor() {
        this.app = express();
        this.setupMiddleware();
    }

    private setupMiddleware(): void {
        setupCorsMiddleware(this.app);
        setupJsonMiddleware(this.app);
    }

    private setupRoutes(): void {
        setupConfigPanelRoutes(this.app);
        // 错误处理中间件必须放在最后
        this.app.use(errorHandler);
    }

    private registerDependencies(): void {
        // 1. 注册 ConfigManagerService（必须最先注册）
        registerConfigManagerService();

        // 2. 注册配置面板所需的依赖
        registerConfigPanelDependencies();
    }

    public async start(): Promise<void> {
        // 1. 注册依赖
        this.registerDependencies();

        // 2. 设置路由
        this.setupRoutes();

        // 3. 从环境变量获取端口，默认使用 3002
        this.port = parseInt(process.env.CONFIG_PANEL_PORT || "3002", 10);

        // 4. 启动服务
        this.app.listen(this.port, () => {
            LOGGER.success(`配置面板后端服务启动成功，端口: ${this.port}`);
            LOGGER.info(`健康检查地址: http://localhost:${this.port}/health`);
            LOGGER.info(`配置 Schema: http://localhost:${this.port}/api/config/schema`);
        });
    }
}

// 检查是否为配置面板模式
const isConfigPanelMode = process.env.CONFIG_PANEL_MODE === "true";

if (isConfigPanelMode) {
    // 配置面板模式：启动轻量级服务
    const server = new ConfigPanelServer();

    server.start().catch(error => {
        LOGGER.error(`配置面板启动失败: ${error.message}`);
        process.exit(1);
    });
} else {
    // 正常模式：不启动服务
    LOGGER.info(
        "未读取到 CONFIG_PANEL_MODE 环境变量，不启动配置面板服务。请尝试在大仓根目录执行 npm run config。"
    );
}

export { isConfigPanelMode };
