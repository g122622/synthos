import express, { Express, Request, Response } from "express";
import cors from "cors";
import { AGCDBManager } from "@root/common/database/AGCDBManager";
import { IMDBManager } from "@root/common/database/IMDBManager";
import Logger from "@root/common/util/Logger";
import ConfigManagerService from "@root/common/config/ConfigManagerService";
import https from "https";

export class WebUIServer {
    private app: Express;
    private readonly port: number;
    private agcDBManager: AGCDBManager | null = null;
    private imDBManager: IMDBManager | null = null;
    private readonly LOGGER = Logger.withTag("WebUI-Backend");

    constructor(port?: number) {
        this.port = port || parseInt(process.env.PORT || "3002", 10);
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupGracefulShutdown();
    }

    private setupMiddleware(): void {
        this.app.use(cors());
        this.app.use(express.json());
    }

    private setupRoutes(): void {
        // 获取所有群组详情
        this.app.get("/api/group-details", this.handleGetAllGroupDetails.bind(this));

        // 获取聊天消息
        this.app.get(
            "/api/chat-messages-by-group-id",
            this.handleGetChatMessagesByGroupId.bind(this)
        );

        // 获取AI摘要结果
        this.app.get(
            "/api/ai-digest-result-by-topic-id",
            this.handleGetAIDigestResultByTopicId.bind(this)
        );
        this.app.get(
            "/api/ai-digest-results-by-session-id",
            this.handleGetAIDigestResultsBySessionId.bind(this)
        );

        // 检查会话是否已摘要
        this.app.get("/api/is-session-summarized", this.handleCheckSessionSummarized.bind(this));

        // 获取QQ号码对应的头像
        this.app.get("/api/qq-avatar", this.handleGetQQAvatar.bind(this));

        // 健康检查
        this.app.get("/health", this.handleHealthCheck.bind(this));
    }

    private setupGracefulShutdown(): void {
        process.on("SIGINT", this.gracefulShutdown.bind(this));
    }

    private async gracefulShutdown(): Promise<void> {
        this.LOGGER.warning("收到SIGINT信号，正在关闭服务...");

        if (this.agcDBManager) await this.agcDBManager.close();
        if (this.imDBManager) await this.imDBManager.close();

        this.LOGGER.success("服务已关闭");
        process.exit(0);
    }

    // --- Route Handlers ---

    private async handleGetAIDigestResultByTopicId(req: Request, res: Response): Promise<void> {
        try {
            const { topicId } = req.query;

            if (!topicId || typeof topicId !== "string") {
                res.status(400).json({ success: false, message: "缺少topicId参数" });
                return;
            }

            const result = await this.agcDBManager!.getAIDigestResultByTopicId(topicId);
            if (result) {
                res.json({ success: true, data: result });
            } else {
                res.status(404).json({ success: false, message: "未找到对应的摘要结果" });
            }
        } catch (error) {
            this.LOGGER.error(`获取AI摘要结果失败: ${error}`);
            res.status(500).json({ success: false, message: "服务器内部错误" });
        }
    }

    private async handleGetAIDigestResultsBySessionId(req: Request, res: Response): Promise<void> {
        try {
            const { sessionId } = req.query;
            if (!sessionId || typeof sessionId !== "string") {
                res.status(400).json({ success: false, message: "缺少sessionId参数" });
                return;
            }

            const results = await this.agcDBManager!.getAIDigestResultsBySessionId(sessionId);
            res.json({ success: true, data: results });
        } catch (error) {
            this.LOGGER.error(`获取AI摘要结果失败: ${error}`);
            res.status(500).json({ success: false, message: "服务器内部错误" });
        }
    }

    private async handleGetChatMessagesByGroupId(req: Request, res: Response): Promise<void> {
        try {
            const { groupId, timeStart, timeEnd } = req.query;

            if (!groupId || !timeStart || !timeEnd || typeof groupId !== "string") {
                res.status(400).json({
                    success: false,
                    message: "缺少必要的参数: groupId, timeStart, timeEnd"
                });
                return;
            }

            const messages =
                await this.imDBManager!.getProcessedChatMessageWithRawMessageByGroupIdAndTimeRange(
                    groupId,
                    parseInt(timeStart as string, 10),
                    parseInt(timeEnd as string, 10)
                );

            res.json({ success: true, data: messages });
        } catch (error) {
            this.LOGGER.error(`获取聊天消息失败: ${error}`);
            res.status(500).json({ success: false, message: "服务器内部错误" });
        }
    }

    private async handleCheckSessionSummarized(req: Request, res: Response): Promise<void> {
        try {
            const { sessionId } = req.query;

            if (!sessionId || typeof sessionId !== "string") {
                res.status(400).json({ success: false, message: "缺少sessionId参数" });
                return;
            }

            const isSummarized = await this.agcDBManager!.isSessionIdSummarized(sessionId);
            res.json({ success: true, data: { isSummarized } });
        } catch (error) {
            this.LOGGER.error(`检查会话摘要状态失败: ${error}`);
            res.status(500).json({ success: false, message: "服务器内部错误" });
        }
    }

    private async handleGetAllGroupDetails(_req: Request, res: Response): Promise<void> {
        try {
            const groupConfigs = (await ConfigManagerService.getCurrentConfig()).groupConfigs;
            res.json({ success: true, data: groupConfigs });
        } catch (error) {
            this.LOGGER.error(`获取所有群组详情失败: ${error}`);
            res.status(500).json({ success: false, message: "服务器内部错误" });
        }
    }

    private handleHealthCheck(_req: Request, res: Response): void {
        res.json({
            success: true,
            message: "WebUI后端服务运行正常",
            timestamp: new Date().toISOString()
        });
    }

    /**
     * 获取QQ号码对应的头像，使用 http://q1.qlogo.cn/g?b=qq&nk=QQ号码&s=100 接口
     * 服务器下载头像之后，返回头像的base64编码
     */
    private async handleGetQQAvatar(req: Request, res: Response): Promise<void> {
        function downloadImage(url: string): Promise<Buffer> {
            return new Promise((resolve, reject) => {
                https
                    .get(url, res => {
                        if (res.statusCode !== 200) {
                            reject(new Error(`HTTP 状态码 ${res.statusCode}`));
                            return;
                        }

                        const chunks: Buffer[] = [];
                        res.on("data", chunk => chunks.push(chunk));
                        res.on("end", () => resolve(Buffer.concat(chunks)));
                    })
                    .on("error", reject);
            });
        }

        try {
            const { qqNumber } = req.query;

            if (!qqNumber || typeof qqNumber !== "string") {
                res.status(400).json({ success: false, message: "缺少qqNumber参数" });
                return;
            }

            const avatarUrl = `http://q1.qlogo.cn/g?b=qq&nk=${qqNumber}&s=100`;
            // 下载
            const avatarBuffer = await downloadImage(avatarUrl);
            const avatarBase64 = avatarBuffer.toString("base64");
            res.json({ success: true, data: { avatarBase64 } });
        } catch (error) {
            this.LOGGER.error(`获取QQ头像失败: ${error}`);
            res.status(500).json({ success: false, message: "服务器内部错误" });
        }
    }

    // --- Lifecycle Methods ---

    private async initializeDatabases(): Promise<void> {
        try {
            this.agcDBManager = new AGCDBManager();
            this.imDBManager = new IMDBManager();

            await this.agcDBManager.init();
            await this.imDBManager.init();

            this.LOGGER.success("数据库初始化完成");
        } catch (error) {
            this.LOGGER.error(`数据库初始化失败: ${error}`);
            process.exit(1);
        }
    }

    public async start(): Promise<void> {
        await this.initializeDatabases();

        this.app.listen(this.port, () => {
            this.LOGGER.success(`WebUI后端服务启动成功，端口: ${this.port}`);
            this.LOGGER.info(`健康检查地址: http://localhost:${this.port}/health`);
        });
    }
}

// 启动入口
const server = new WebUIServer();
server.start().catch(error => {
    Logger.withTag("WebUI-Backend").error(`启动失败: ${error.message}`);
    process.exit(1);
});
