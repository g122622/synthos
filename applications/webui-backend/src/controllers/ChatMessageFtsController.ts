/**
 * 聊天消息全文检索（FTS）控制器
 */
import { Request, Response } from "express";
import { injectable, inject } from "tsyringe";
import { TOKENS } from "../di/tokens";
import { ChatMessageFtsService } from "../services/ChatMessageFtsService";
import { ChatMessageFtsContextSchema, ChatMessageFtsSearchSchema } from "../schemas/index";

@injectable()
export class ChatMessageFtsController {
    constructor(@inject(TOKENS.ChatMessageFtsService) private chatMessageFtsService: ChatMessageFtsService) {}

    /**
     * POST /api/chat-messages-fts-search
     */
    public async search(req: Request, res: Response): Promise<void> {
        const params = ChatMessageFtsSearchSchema.parse(req.body);

        const data = await this.chatMessageFtsService.search({
            query: params.query,
            groupIds: params.groupIds,
            timeStart: params.timeStart,
            timeEnd: params.timeEnd,
            page: params.page,
            pageSize: params.pageSize
        });

        res.json({ success: true, data });
    }

    /**
     * POST /api/chat-messages-fts-context
     */
    public async getContext(req: Request, res: Response): Promise<void> {
        const params = ChatMessageFtsContextSchema.parse(req.body);
        const data = await this.chatMessageFtsService.getContext({
            groupId: params.groupId,
            msgId: params.msgId,
            before: params.before,
            after: params.after
        });

        res.json({ success: true, data });
    }
}
