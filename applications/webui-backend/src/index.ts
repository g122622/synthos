/**
 * WebUI 后端服务入口
 */
import "reflect-metadata";
import express, { Express } from "express";
import * as path from "path";

// 基础设施
import { AgcDbAccessService} from "@root/common/services/database/AgcDbAccessService";
import { ImDbAccessService} from "@root/common/services/database/ImDbAccessService";
import { InterestScoreDbAccessService } from "@root/common/services/database/InterestScoreDbAccessService";
import { ReportDbAccessService} from "@root/common/services/database/ReportDbAccessService";
import Logger from "@root/common/util/Logger";

// DI 容器
import {
    registerDBManagers,
    registerStatusManagers,
    registerRagChatHistoryManager,
    registerRAGClient,
    registerServices,
    registerControllers,
    registerConfigManagerService,
    container
} from "./di/container";
import { TOKENS } from "./di/tokens";
import type ConfigManagerServiceType from "@root/common/services/config/ConfigManagerService";

// 仓库
import { TopicFavoriteStatusManager } from "./repositories/TopicFavoriteStatusManager";
import { TopicReadStatusManager } from "./repositories/TopicReadStatusManager";
import { RagChatHistoryManager } from "./repositories/RagChatHistoryManager";
import { ReportReadStatusManager } from "./repositories/ReportReadStatusManager";

// 中间件
import { setupCorsMiddleware } from "./middleware/corsMiddleware";
import { setupJsonMiddleware } from "./middleware/jsonMiddleware";
import { errorHandler } from "./errors/errorHandler";

// 路由
import { setupApiRoutes } from "./routers/apiRouter";

// 生命周期
import { setupGracefulShutdown } from "./lifecycle/gracefulShutdown";
import { initializeDatabases, closeDatabases } from "./lifecycle/dbInitialization";
import { bootstrap, bootstrapAll } from "@root/common/util/lifecycle/bootstrap";
import { setupConfigPanelRoutes } from "./routers/configPanelRouter";

const LOGGER = Logger.withTag("WebUI-Backend");

@bootstrap
export class WebUILocalServer {
    private app: Express;
    private port: number = 3002;
    private agcDbAccessService: AgcDbAccessService | null = null;
    private imDbAccessService: ImDbAccessService | null = null;
    private interestScoreDbAccessService: InterestScoreDbAccessService | null = null;
    private reportDbAccessService: ReportDbAccessService | null = null;

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
        setupConfigPanelRoutes(this.app);
        // 错误处理中间件必须放在最后
        this.app.use(errorHandler);
    }

    private setupGracefulShutdown(): void {
        setupGracefulShutdown(this);
    }

    public async closeDatabases(): Promise<void> {
        await closeDatabases(this.agcDbAccessService, this.imDbAccessService, this.interestScoreDbAccessService, this.reportDbAccessService);
    }

    private async initializeDatabases(): Promise<void> {
        const { agcDbAccessService, imDbAccessService, interestScoreDbAccessService, reportDbAccessService } = await initializeDatabases();
        this.agcDbAccessService = agcDbAccessService;
        this.imDbAccessService = imDbAccessService;
        this.interestScoreDbAccessService = interestScoreDbAccessService;
        this.reportDbAccessService = reportDbAccessService;
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
        reportReadStatusManager: ReportReadStatusManager;
    }> {
        const config = await this.getConfigManagerService().getCurrentConfig();
        const favoriteStatusManager = TopicFavoriteStatusManager.getInstance(
            path.join(config.webUI_Backend.kvStoreBasePath, "favorite_topics")
        );
        const readStatusManager = TopicReadStatusManager.getInstance(
            path.join(config.webUI_Backend.kvStoreBasePath, "read_topics")
        );
        const reportReadStatusManager = ReportReadStatusManager.getInstance(
            path.join(config.webUI_Backend.kvStoreBasePath, "read_reports")
        );
        return { favoriteStatusManager, readStatusManager, reportReadStatusManager };
    }

    private async initializeRagChatHistoryManager(): Promise<RagChatHistoryManager> {
        const config = await this.getConfigManagerService().getCurrentConfig();
        const ragChatHistoryManager = RagChatHistoryManager.getInstance(
            config.webUI_Backend.dbBasePath
        );
        await ragChatHistoryManager.init();
        return ragChatHistoryManager;
    }

    private async registerDependencies(): Promise<void> {
        // 0. 注册 ConfigManagerService（必须最先注册）
        registerConfigManagerService();

        // 1. 注册 DBManagers
        registerDBManagers(
            this.agcDbAccessService!,
            this.imDbAccessService!,
            this.interestScoreDbAccessService!,
            this.reportDbAccessService!
        );

        // 2. 注册 Status Managers
        const { favoriteStatusManager, readStatusManager, reportReadStatusManager } = await this.initializeStatusManagers();
        registerStatusManagers(favoriteStatusManager, readStatusManager, reportReadStatusManager);

        // 2.5. 注册 RAG 聊天历史管理器
        const ragChatHistoryManager = await this.initializeRagChatHistoryManager();
        registerRagChatHistoryManager(ragChatHistoryManager);

        // 3. 注册 RAG RPC 客户端
        const config = await this.getConfigManagerService().getCurrentConfig();
        const rpcPort = config.ai?.rpc?.port || 7979;
        registerRAGClient(`http://localhost:${rpcPort}`);

        // 4. 注册 Services
        registerServices();

        // 5. 注册 Controllers
        registerControllers();
    }

    public async main(): Promise<void> {
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

// 启动应用
bootstrapAll();
