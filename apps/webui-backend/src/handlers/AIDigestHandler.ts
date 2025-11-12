import { Request, Response } from "express";
import { BaseHandler } from "./BaseHandler";

export class AIDigestHandler extends BaseHandler {
    public async handleGetAIDigestResultByTopicId(req: Request, res: Response): Promise<void> {
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

    public async handleGetAIDigestResultsBySessionIds(req: Request, res: Response): Promise<void> {
        try {
            const { sessionIds } = req.body;
            if (!sessionIds || !Array.isArray(sessionIds)) {
                res.status(400).json({ success: false, message: "缺少sessionIds参数" });
                return;
            }

            const results = []
            for (const sessionId of sessionIds) {
                results.push({
                    sessionId,
                    result: await this.agcDBManager!.getAIDigestResultsBySessionId(sessionId)
                });
            }
            res.json({ success: true, data: results });
        } catch (error) {
            this.LOGGER.error(`获取AI摘要结果失败: ${error}`);
            res.status(500).json({ success: false, message: "服务器内部错误" });
        }
    }

    public async handleCheckSessionSummarized(req: Request, res: Response): Promise<void> {
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
}
