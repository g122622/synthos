/**
 * WebUI 后端服务入口
 */
import "reflect-metadata";
import express, { Express } from "express";
import * as path from "path";

// 基础设施
import { AgcDbAccessService } from "@root/common/services/database/AgcDbAccessService";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { ImDbFtsService } from "@root/common/services/database/fts/ImDbFtsService";
import { InterestScoreDbAccessService } from "@root/common/services/database/InterestScoreDbAccessService";
import { ReportDbAccessService } from "@root/common/services/database/ReportDbAccessService";
import Logger from "@root/common/util/Logger";

// DI 容器
import {
    registerStatusManagers,
    registerRagChatHistoryManager,
    registerRAGClient,
    registerServices,
    registerControllers,
    registerConfigManagerService,
    registerCommonDBService
} from "./di/container";
import ConfigManagerService from "@root/common/services/config/ConfigManagerService";

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

// WebSocket & HTTP Server
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import { appRouter } from "./rpc/router";

const LOGGER = Logger.withTag("WebUI-Backend");

@bootstrap
export class WebUILocalServer {
    private app: Express;
    private port: number = 3002;
    private agcDbAccessService: AgcDbAccessService | null = null;
    private imDbAccessService: ImDbAccessService | null = null;
    private interestScoreDbAccessService: InterestScoreDbAccessService | null = null;
    private reportDbAccessService: ReportDbAccessService | null = null;
    private imDbFtsService: ImDbFtsService | null = null;

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
        await closeDatabases(
            this.agcDbAccessService,
            this.imDbAccessService,
            this.imDbFtsService,
            this.interestScoreDbAccessService,
            this.reportDbAccessService
        );
    }

    private async initializeDatabases(): Promise<void> {
        const {
            agcDbAccessService,
            imDbAccessService,
            imDbFtsService,
            interestScoreDbAccessService,
            reportDbAccessService
        } = await initializeDatabases();
        this.agcDbAccessService = agcDbAccessService;
        this.imDbAccessService = imDbAccessService;
        this.imDbFtsService = imDbFtsService;
        this.interestScoreDbAccessService = interestScoreDbAccessService;
        this.reportDbAccessService = reportDbAccessService;
    }

    private async initializeStatusManagers(): Promise<{
        favoriteStatusManager: TopicFavoriteStatusManager;
        readStatusManager: TopicReadStatusManager;
        reportReadStatusManager: ReportReadStatusManager;
    }> {
        const config = await ConfigManagerService.getCurrentConfig();
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
        const config = await ConfigManagerService.getCurrentConfig();
        const ragChatHistoryManager = RagChatHistoryManager.getInstance(config.webUI_Backend.dbBasePath);
        await ragChatHistoryManager.init();
        return ragChatHistoryManager;
    }

    private async registerDependencies(): Promise<void> {
        // 注意：ConfigManagerService 和 CommonDBService 已在 main() 中提前注册
        // 注意：DBManagers 已在 initializeDatabases 中注册到 DI 容器

        // 1. 注册 Status Managers
        const { favoriteStatusManager, readStatusManager, reportReadStatusManager } =
            await this.initializeStatusManagers();
        registerStatusManagers(favoriteStatusManager, readStatusManager, reportReadStatusManager);

        // 2. 注册 RAG 聊天历史管理器
        const ragChatHistoryManager = await this.initializeRagChatHistoryManager();
        registerRagChatHistoryManager(ragChatHistoryManager);

        // 3. 注册 RAG RPC 客户端
        const config = await ConfigManagerService.getCurrentConfig();
        const rpcPort = config.ai.rpc.port;
        const rpcBaseUrl = (process.env.SYNTHOS_AI_RPC_BASE_URL || "").trim() || `http://localhost:${rpcPort}`;
        registerRAGClient(rpcBaseUrl);

        // 4. 注册 Services
        registerServices();

        // 5. 注册 Controllers
        registerControllers();
    }

    public async main(): Promise<void> {
        // 1. 注册基础 DI 服务（必须最先）
        registerConfigManagerService();
        registerCommonDBService();

        // 2. 初始化数据库（需要 CommonDBService）
        await this.initializeDatabases();

        // 3. 注册其他依赖
        await this.registerDependencies();

        // 4. 设置路由（必须在依赖注册后）
        this.setupRoutes();

        // 5. 设置优雅关闭
        this.setupGracefulShutdown();

        // 6. 获取端口配置
        this.port = (await ConfigManagerService.getCurrentConfig()).webUI_Backend.port;

        // 7. 启动服务 (HTTP + WebSocket)
        const httpServer = createServer(this.app);

        // 设置 WebSocket 服务，用于 tRPC subscription 转发
        const wss = new WebSocketServer({ server: httpServer, path: "/trpc" });
        applyWSSHandler({ wss, router: appRouter });
        LOGGER.info(`Backend WebSocket Server (Forwarder) initialized`);

        httpServer.listen(this.port, () => {
            LOGGER.success(`WebUI后端服务启动成功，端口: ${this.port}`);
            LOGGER.info(`健康检查地址: http://localhost:${this.port}/health`);
        });
    }
}

// 启动应用
bootstrapAll();
