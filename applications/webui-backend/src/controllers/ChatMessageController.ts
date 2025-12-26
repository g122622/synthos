/**
 * 聊天消息控制器
 */
import { Request, Response } from "express";
import { injectable, inject } from "tsyringe";
import { TOKENS } from "../di/tokens";
import { ChatMessageService } from "../services/ChatMessageService";
import {
    GetChatMessagesByGroupIdSchema,
    GetSessionIdsByGroupIdsAndTimeRangeSchema,
    GetSessionTimeDurationsSchema,
    GetMessageHourlyStatsSchema
} from "../schemas/index";

@injectable()
export class ChatMessageController {
    constructor(
        @inject(TOKENS.ChatMessageService) private chatMessageService: ChatMessageService
    ) {}

    /**
     * GET /api/chat-messages-by-group-id
     */
    public async getChatMessagesByGroupId(req: Request, res: Response): Promise<void> {
        const params = GetChatMessagesByGroupIdSchema.parse(req.query);
        const messages = await this.chatMessageService.getChatMessagesByGroupIdAndTimeRange(
            params.groupId,
            parseInt(params.timeStart, 10),
            parseInt(params.timeEnd, 10)
        );
        res.json({ success: true, data: messages });
    }

    /**
     * POST /api/session-ids-by-group-ids-and-time-range
     */
    public async getSessionIdsByGroupIdsAndTimeRange(req: Request, res: Response): Promise<void> {
        const params = GetSessionIdsByGroupIdsAndTimeRangeSchema.parse(req.body);
        const timeStart =
            typeof params.timeStart === "string"
                ? parseInt(params.timeStart, 10)
                : params.timeStart;
        const timeEnd =
            typeof params.timeEnd === "string" ? parseInt(params.timeEnd, 10) : params.timeEnd;

        const results = await this.chatMessageService.getSessionIdsByGroupIdsAndTimeRange(
            params.groupIds,
            timeStart,
            timeEnd
        );
        res.json({ success: true, data: results });
    }

    /**
     * POST /api/session-time-durations
     */
    public async getSessionTimeDurations(req: Request, res: Response): Promise<void> {
        const params = GetSessionTimeDurationsSchema.parse(req.body);
        const results = await this.chatMessageService.getSessionTimeDurations(params.sessionIds);
        res.json({ success: true, data: results });
    }

    /**
     * POST /api/message-hourly-stats
     * 获取多个群组的每小时消息统计（包括当前24小时和前一天24小时）
     */
    public async getMessageHourlyStats(req: Request, res: Response): Promise<void> {
        const params = GetMessageHourlyStatsSchema.parse(req.body);
        const results = await this.chatMessageService.getMessageHourlyStats(params.groupIds);
        res.json({ success: true, data: results });
    }
}
