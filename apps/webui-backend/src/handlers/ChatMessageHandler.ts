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
}
