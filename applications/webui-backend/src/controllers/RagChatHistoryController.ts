/**
 * RAG 聊天历史控制器
 * 处理 RAG 问答历史记录的 HTTP 请求
 */
import { Request, Response } from "express";
import { injectable, inject } from "tsyringe";
import { TOKENS } from "../di/tokens";
import { RagChatHistoryService } from "../services/RagChatHistoryService";
import {
    GetRagSessionListSchema,
    RagSessionIdSchema,
    UpdateRagSessionTitleSchema,
    ToggleSessionPinSchema
} from "../schemas/index";

@injectable()
export class RagChatHistoryController {
    constructor(@inject(TOKENS.RagChatHistoryService) private ragChatHistoryService: RagChatHistoryService) {}

    /**
     * POST /api/rag/session/list
     * 获取会话列表
     */
    async getSessionList(req: Request, res: Response): Promise<void> {
        const params = GetRagSessionListSchema.parse(req.body);
        const result = await this.ragChatHistoryService.getSessionList(params.limit, params.offset);
        res.json({ success: true, data: result });
    }

    /**
     * POST /api/rag/session/detail
     * 获取会话详情
     */
    async getSessionDetail(req: Request, res: Response): Promise<void> {
        const params = RagSessionIdSchema.parse(req.body);
        const session = await this.ragChatHistoryService.getSessionById(params.sessionId);
        if (!session) {
            res.json({ success: false, message: "会话不存在" });
            return;
        }
        res.json({ success: true, data: session });
    }

    /**
     * POST /api/rag/session/delete
     * 删除会话
     */
    async deleteSession(req: Request, res: Response): Promise<void> {
        const params = RagSessionIdSchema.parse(req.body);
        await this.ragChatHistoryService.deleteSession(params.sessionId);
        res.json({ success: true, message: "会话已删除" });
    }

    /**
     * POST /api/rag/session/update-title
     * 更新会话标题
     */
    async updateSessionTitle(req: Request, res: Response): Promise<void> {
        const params = UpdateRagSessionTitleSchema.parse(req.body);
        await this.ragChatHistoryService.updateSessionTitle(params.sessionId, params.title);
        res.json({ success: true, message: "标题已更新" });
    }

    /**
     * POST /api/rag/session/clear-all
     * 清空所有会话
     */
    async clearAllSessions(req: Request, res: Response): Promise<void> {
        await this.ragChatHistoryService.clearAllSessions();
        res.json({ success: true, message: "所有会话已清空" });
    }

    /**
     * POST /api/rag/session/toggle-pin
     * 切换会话的置顶状态
     */
    async toggleSessionPin(req: Request, res: Response): Promise<void> {
        const params = ToggleSessionPinSchema.parse(req.body);
        await this.ragChatHistoryService.toggleSessionPin(params.sessionId, params.pinned);
        res.json({ success: true, message: params.pinned ? "会话已置顶" : "会话已取消置顶" });
    }
}
