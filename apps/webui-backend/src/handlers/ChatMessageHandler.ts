import { Request, Response } from "express";
import { BaseHandler } from "./BaseHandler";

export class ChatMessageHandler extends BaseHandler {
    public async handleGetChatMessagesByGroupId(req: Request, res: Response): Promise<void> {
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

    public async handleGetSessionIdsByGroupIdsAndTimeRange(
        req: Request,
        res: Response
    ): Promise<void> {
        try {
            const { groupIds, timeStart, timeEnd } = req.body;

            if (!groupIds || !timeStart || !timeEnd || !Array.isArray(groupIds)) {
                res.status(400).json({
                    success: false,
                    message: "缺少必要的参数: groupId, timeStart, timeEnd"
                });
                return;
            }

            const results = [];
            for (const groupId of groupIds as string[]) {
                const sessionIds = await this.imDBManager!.getSessionIdsByGroupIdAndTimeRange(
                    groupId,
                    parseInt(timeStart as string, 10),
                    parseInt(timeEnd as string, 10)
                );
                results.push({ groupId, sessionIds });
            }
            res.json({ success: true, data: results });
        } catch (error) {
            this.LOGGER.error(`获取会话ID失败: ${error}`);
            res.status(500).json({ success: false, message: "服务器内部错误" });
        }
    }

    public async handleGetSessionTimeDurations(req: Request, res: Response): Promise<void> {
        try {
            const { sessionIds } = req.body;

            if (!sessionIds || !Array.isArray(sessionIds)) {
                res.status(400).json({ success: false, message: "缺少sessionIds参数" });
                return;
            }

            const results = [];
            for (const sessionId of sessionIds as string[]) {
                const result = await this.imDBManager!.getSessionTimeDuration(sessionId);
                results.push({
                    sessionId,
                    timeStart: result?.timeStart,
                    timeEnd: result?.timeEnd
                });
            }
            res.json({ success: true, data: results });
        } catch (error) {
            this.LOGGER.error(`获取会话时间失败: ${error}`);
            res.status(500).json({ success: false, message: "服务器内部错误" });
        }
    }
}
