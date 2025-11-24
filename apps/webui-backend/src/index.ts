import express, { Express, Request, Response } from "express";
import { AGCDBManager } from "@root/common/database/AGCDBManager";
import { IMDBManager } from "@root/common/database/IMDBManager";
import { InterestScoreDBManager } from "@root/common/database/InterestScoreDBManager";
import Logger from "@root/common/util/Logger";
import ConfigManagerService from "@root/common/config/ConfigManagerService";

// 中间件
import { setupCorsMiddleware } from "./middleware/corsMiddleware";
import { setupJsonMiddleware } from "./middleware/jsonMiddleware";

// 路由
import { setupApiRoutes } from "./routers/apiRouter";

// 生命周期
import { setupGracefulShutdown } from "./lifecycle/gracefulShutdown";
import { initializeDatabases, closeDatabases } from "./lifecycle/dbInitialization";

// 处理函数
import { AIDigestHandler } from "./handlers/AIDigestHandler";
import { ChatMessageHandler } from "./handlers/ChatMessageHandler";
import { GroupConfigHandler } from "./handlers/GroupConfigHandler";
import { MiscHandler } from "./handlers/MiscHandler";
import { InterestScoreHandler } from "./handlers/InterestScoreHandler";
import { TopicStatusHandler } from "./handlers/TopicStatusHandler";

export class WebUILocalServer {
    private app: Express;
    private port: number = 3002;
    private agcDBManager: AGCDBManager | null = null;
    private imDBManager: IMDBManager | null = null;
    private interestScoreDBManager: InterestScoreDBManager | null = null;
    private readonly LOGGER = Logger.withTag("WebUI-Backend");

    // 处理函数实例
    private aiDigestHandler: AIDigestHandler;
    private chatMessageHandler: ChatMessageHandler;
    private groupConfigHandler: GroupConfigHandler;
    private miscHandler: MiscHandler;
    private interestScoreHandler: InterestScoreHandler;
    private topicStatusHandler: TopicStatusHandler;

    constructor(port?: number) {
        this.app = express();

        // 初始化处理函数
        this.aiDigestHandler = new AIDigestHandler(
            this.agcDBManager,
            this.imDBManager,
            this.interestScoreDBManager
        );
        this.chatMessageHandler = new ChatMessageHandler(
            this.agcDBManager,
            this.imDBManager,
            this.interestScoreDBManager
        );
        this.groupConfigHandler = new GroupConfigHandler(
            this.agcDBManager,
            this.imDBManager,
            this.interestScoreDBManager
        );
        this.miscHandler = new MiscHandler(
            this.agcDBManager,
            this.imDBManager,
            this.interestScoreDBManager
        );
        this.interestScoreHandler = new InterestScoreHandler(
            this.agcDBManager,
            this.imDBManager,
            this.interestScoreDBManager
        );
        this.topicStatusHandler = new TopicStatusHandler(
            this.agcDBManager,
            this.imDBManager,
            this.interestScoreDBManager
        );

        this.setupMiddleware();
        this.setupRoutes();
        this.setupGracefulShutdown();
    }

    private setupMiddleware(): void {
        setupCorsMiddleware(this.app);
        setupJsonMiddleware(this.app);
    }

    private setupRoutes(): void {
        setupApiRoutes(this.app, this);
    }

    private setupGracefulShutdown(): void {
        setupGracefulShutdown(this);
    }

    public async closeDatabases(): Promise<void> {
        await closeDatabases(this.agcDBManager, this.imDBManager, this.interestScoreDBManager);
    }

    // 更新数据库管理器引用
    public updateDBManagers(
        agcDBManager: AGCDBManager,
        imDBManager: IMDBManager,
        interestScoreDBManager: InterestScoreDBManager
    ): void {
        this.agcDBManager = agcDBManager;
        this.imDBManager = imDBManager;
        this.interestScoreDBManager = interestScoreDBManager;

        // 更新处理函数中的数据库引用
        this.aiDigestHandler = new AIDigestHandler(
            agcDBManager,
            imDBManager,
            interestScoreDBManager
        );
        this.chatMessageHandler = new ChatMessageHandler(
            agcDBManager,
            imDBManager,
            interestScoreDBManager
        );
        this.groupConfigHandler = new GroupConfigHandler(
            agcDBManager,
            imDBManager,
            interestScoreDBManager
        );
        this.miscHandler = new MiscHandler(agcDBManager, imDBManager, interestScoreDBManager);
        this.interestScoreHandler = new InterestScoreHandler(
            agcDBManager,
            imDBManager,
            interestScoreDBManager
        );
        this.topicStatusHandler = new TopicStatusHandler(
            agcDBManager,
            imDBManager,
            interestScoreDBManager
        );
    }

    // --- Route Handlers ---

    public async handleGetAIDigestResultByTopicId(req: Request, res: Response): Promise<void> {
        return this.aiDigestHandler.handleGetAIDigestResultByTopicId(req, res);
    }

    public async handleGetAIDigestResultsBySessionIds(req: Request, res: Response): Promise<void> {
        return this.aiDigestHandler.handleGetAIDigestResultsBySessionIds(req, res);
    }

    public async handleGetChatMessagesByGroupId(req: Request, res: Response): Promise<void> {
        return this.chatMessageHandler.handleGetChatMessagesByGroupId(req, res);
    }

    public async handleGetSessionIdsByGroupIdsAndTimeRange(
        req: Request,
        res: Response
    ): Promise<void> {
        return this.chatMessageHandler.handleGetSessionIdsByGroupIdsAndTimeRange(req, res);
    }

    public async handleGetSessionTimeDurations(req: Request, res: Response): Promise<void> {
        return this.chatMessageHandler.handleGetSessionTimeDurations(req, res);
    }

    public async handleCheckSessionSummarized(req: Request, res: Response): Promise<void> {
        return this.aiDigestHandler.handleCheckSessionSummarized(req, res);
    }

    public async handleGetAllGroupDetails(req: Request, res: Response): Promise<void> {
        return this.groupConfigHandler.handleGetAllGroupDetails(req, res);
    }

    public handleHealthCheck(req: Request, res: Response): void {
        return this.miscHandler.handleHealthCheck(req, res);
    }

    public async handleGetQQAvatar(req: Request, res: Response): Promise<void> {
        return this.miscHandler.handleGetQQAvatar(req, res);
    }

    public async handleGetInterestScoreResults(req: Request, res: Response): Promise<void> {
        return this.interestScoreHandler.handleGetInterestScoreResults(req, res);
    }

    // --- Topic Status Handlers ---

    public async handleMarkAsFavorite(req: Request, res: Response): Promise<void> {
        return this.topicStatusHandler.handleMarkAsFavorite(req, res);
    }

    public async handleRemoveFromFavorites(req: Request, res: Response): Promise<void> {
        return this.topicStatusHandler.handleRemoveFromFavorites(req, res);
    }

    public async handleCheckFavoriteStatus(req: Request, res: Response): Promise<void> {
        return this.topicStatusHandler.handleCheckFavoriteStatus(req, res);
    }

    public async handleMarkAsRead(req: Request, res: Response): Promise<void> {
        return this.topicStatusHandler.handleMarkAsRead(req, res);
    }

    public async handleMarkAsUnread(req: Request, res: Response): Promise<void> {
        return this.topicStatusHandler.handleMarkAsUnread(req, res);
    }

    public async handleCheckReadStatus(req: Request, res: Response): Promise<void> {
        return this.topicStatusHandler.handleCheckReadStatus(req, res);
    }

    // --- Lifecycle Methods ---

    private async initializeDatabases(): Promise<void> {
        const { agcDBManager, imDBManager, interestScoreDBManager } = await initializeDatabases();
        this.updateDBManagers(agcDBManager, imDBManager, interestScoreDBManager);
    }

    public async start(): Promise<void> {
        await this.initializeDatabases();

        this.port = (await ConfigManagerService.getCurrentConfig()).webUI_Backend.port;

        this.app.listen(this.port, () => {
            this.LOGGER.success(`WebUI后端服务启动成功，端口: ${this.port}`);
            this.LOGGER.info(`健康检查地址: http://localhost:${this.port}/health`);
        });
    }
}

// 启动入口
const server = new WebUILocalServer();
server.start().catch(error => {
    Logger.withTag("WebUI-Backend").error(`启动失败: ${error.message}`);
    process.exit(1);
});

// migrate-favorites.ts
// import { readFile } from "fs/promises";
// import TopicFavoriteStatusManager from "./repositories/TopicFavoriteStatusManager";
// import TopicReadStatusManager from "./repositories/TopicReadStatusManager";

// async function migrateFavFromFile(filePath: string): Promise<void> {
//     try {
//         const content = await readFile(filePath, "utf-8");
//         const favorites: Record<string, boolean> = JSON.parse(content);

//         const manager = TopicFavoriteStatusManager.getInstance();

//         // 批量写入（可选：使用 batch 提升性能）
//         const ops = Object.entries(favorites)
//             .filter(([, isFav]) => isFav) // 只导入 true 的项
//             .map(([topicId]) => ({ type: "put" as const, key: topicId, value: true }));

//         if (ops.length > 0) {
//             await manager.store.batch(ops);
//             console.log(`✅ 成功迁移 ${ops.length} 个收藏话题`);
//         } else {
//             console.log("⚠️ 无有效收藏数据");
//         }

//         await manager.close();
//     } catch (error) {
//         console.error("❌ 迁移失败:", error);
//         process.exit(1);
//     }
// }

// async function migrateReadFromFile(filePath: string): Promise<void> {
//     try {
//         const content = await readFile(filePath, "utf-8");
//         const readStatuses: Record<string, boolean> = JSON.parse(content);
//         const manager = TopicReadStatusManager.getInstance();
//         // 批量写入（可选：使用 batch 提升性能）
//         const ops = Object.entries(readStatuses)
//             .filter(([, isRead]) => isRead) // 只导入 true 的项
//             .map(([topicId]) => ({ type: "put" as const, key: topicId, value: true }));
//         if (ops.length > 0) {
//             await manager.store.batch(ops);
//             console.log(`✅ 成功迁移 ${ops.length} 个已读话题`);
//         } else {
//             console.log("⚠️ 无有效已读数据");
//         }
//         await manager.close();
//     } catch (error) {
//         console.error("❌ 迁移失败:", error);
//         process.exit(1);
//     }
// }

// migrateFavFromFile("./favorite_topics_export.json");
// migrateReadFromFile("./read_topics_export.json");
