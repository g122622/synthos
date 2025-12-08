/**
 * WebUI 后端服务入口
 */
import "reflect-metadata";
import express, { Express } from "express";
import * as path from "path";

// 基础设施
import { AGCDBManager } from "@root/common/database/AGCDBManager";
import { IMDBManager } from "@root/common/database/IMDBManager";
import { InterestScoreDBManager } from "@root/common/database/InterestScoreDBManager";
import Logger from "@root/common/util/Logger";

// DI 容器
import {
    registerDBManagers,
    registerStatusManagers,
    registerServices,
    registerControllers,
    registerConfigManagerService,
    container
} from "./di/container";
import { TOKENS } from "./di/tokens";
import type ConfigManagerServiceType from "@root/common/config/ConfigManagerService";

// 仓库
import { TopicFavoriteStatusManager } from "./repositories/TopicFavoriteStatusManager";
import { TopicReadStatusManager } from "./repositories/TopicReadStatusManager";

// 中间件
import { setupCorsMiddleware } from "./middleware/corsMiddleware";
import { setupJsonMiddleware } from "./middleware/jsonMiddleware";
import { errorHandler } from "./errors/errorHandler";

// 路由
import { setupApiRoutes } from "./routers/apiRouter";

// 生命周期
import { setupGracefulShutdown } from "./lifecycle/gracefulShutdown";
import { initializeDatabases, closeDatabases } from "./lifecycle/dbInitialization";

const LOGGER = Logger.withTag("WebUI-Backend");

export class WebUILocalServer {
    private app: Express;
    private port: number = 3002;
    private agcDBManager: AGCDBManager | null = null;
    private imDBManager: IMDBManager | null = null;
    private interestScoreDBManager: InterestScoreDBManager | null = null;

    constructor() {
        this.app = express();
        this.setupMiddleware();
    }

    private setupMiddleware(): void {
        setupCorsMiddleware(this.app);
        setupJsonMiddleware(this.app);
    }

    private setupRoutes(): void {
        setupApiRoutes(this.app);
        // 错误处理中间件必须放在最后
        this.app.use(errorHandler);
    }

    private setupGracefulShutdown(): void {
        setupGracefulShutdown(this);
    }

    public async closeDatabases(): Promise<void> {
        await closeDatabases(this.agcDBManager, this.imDBManager, this.interestScoreDBManager);
    }

    private async initializeDatabases(): Promise<void> {
        const { agcDBManager, imDBManager, interestScoreDBManager } = await initializeDatabases();
        this.agcDBManager = agcDBManager;
        this.imDBManager = imDBManager;
        this.interestScoreDBManager = interestScoreDBManager;
    }

    /**
     * 获取 ConfigManagerService 实例
     */
    private getConfigManagerService(): typeof ConfigManagerServiceType {
        return container.resolve<typeof ConfigManagerServiceType>(TOKENS.ConfigManagerService);
    }

    private async initializeStatusManagers(): Promise<{
        favoriteStatusManager: TopicFavoriteStatusManager;
        readStatusManager: TopicReadStatusManager;
    }> {
        const config = await this.getConfigManagerService().getCurrentConfig();
        const favoriteStatusManager = TopicFavoriteStatusManager.getInstance(
            path.join(config.webUI_Backend.kvStoreBasePath, "favorite_topics")
        );
        const readStatusManager = TopicReadStatusManager.getInstance(
            path.join(config.webUI_Backend.kvStoreBasePath, "read_topics")
        );
        return { favoriteStatusManager, readStatusManager };
    }

    private async registerDependencies(): Promise<void> {
        // 0. 注册 ConfigManagerService（必须最先注册）
        registerConfigManagerService();

        // 1. 注册 DBManagers
        registerDBManagers(
            this.agcDBManager!,
            this.imDBManager!,
            this.interestScoreDBManager!
        );

        // 2. 注册 Status Managers
        const { favoriteStatusManager, readStatusManager } = await this.initializeStatusManagers();
        registerStatusManagers(favoriteStatusManager, readStatusManager);

        // 3. 注册 Services
        registerServices();

        // 4. 注册 Controllers
        registerControllers();
    }

    public async start(): Promise<void> {
        // 1. 初始化数据库
        await this.initializeDatabases();

        // 2. 注册依赖
        await this.registerDependencies();

        // 3. 设置路由（必须在依赖注册后）
        this.setupRoutes();

        // 4. 设置优雅关闭
        this.setupGracefulShutdown();

        // 5. 获取端口配置
        this.port = (await this.getConfigManagerService().getCurrentConfig()).webUI_Backend.port;

        // 6. 启动服务
        this.app.listen(this.port, () => {
            LOGGER.success(`WebUI后端服务启动成功，端口: ${this.port}`);
            LOGGER.info(`健康检查地址: http://localhost:${this.port}/health`);
        });
    }
}

// 启动入口
const server = new WebUILocalServer();
server.start().catch(error => {
    LOGGER.error(`启动失败: ${error.message}`);
    process.exit(1);
});
