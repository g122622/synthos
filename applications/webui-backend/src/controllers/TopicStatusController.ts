/**
 * 话题状态控制器（收藏、已读）
 */
import { Request, Response } from "express";
import { injectable, inject } from "tsyringe";
import { TOKENS } from "../di/tokens";
import { TopicStatusService } from "../services/TopicStatusService";
import { TopicIdSchema, TopicIdsSchema } from "../schemas/index";

@injectable()
export class TopicStatusController {
    constructor(@inject(TOKENS.TopicStatusService) private topicStatusService: TopicStatusService) {}

    // ==================== 收藏相关 ====================

    /**
     * POST /api/topic/favorite/mark
     */
    async markAsFavorite(req: Request, res: Response): Promise<void> {
        const params = TopicIdSchema.parse(req.body);
        await this.topicStatusService.markAsFavorite(params.topicId);
        res.json({ success: true, message: "话题已标记为收藏" });
    }

    /**
     * POST /api/topic/favorite/remove
     */
    async removeFromFavorites(req: Request, res: Response): Promise<void> {
        const params = TopicIdSchema.parse(req.body);
        await this.topicStatusService.removeFromFavorites(params.topicId);
        res.json({ success: true, message: "话题已从收藏中移除" });
    }

    /**
     * POST /api/topic/favorite/status
     */
    async checkFavoriteStatus(req: Request, res: Response): Promise<void> {
        const params = TopicIdsSchema.parse(req.body);
        const favoriteStatus = await this.topicStatusService.checkFavoriteStatus(params.topicIds);
        res.json({ success: true, data: { favoriteStatus } });
    }

    // ==================== 已读相关 ====================

    /**
     * POST /api/topic/read/mark
     */
    async markAsRead(req: Request, res: Response): Promise<void> {
        const params = TopicIdSchema.parse(req.body);
        await this.topicStatusService.markAsRead(params.topicId);
        res.json({ success: true, message: "话题已标记为已读" });
    }

    /**
     * POST /api/topic/read/unmark
     */
    async markAsUnread(req: Request, res: Response): Promise<void> {
        const params = TopicIdSchema.parse(req.body);
        await this.topicStatusService.markAsUnread(params.topicId);
        res.json({ success: true, message: "话题已读状态已清除" });
    }

    /**
     * POST /api/topic/read/status
     */
    async checkReadStatus(req: Request, res: Response): Promise<void> {
        const params = TopicIdsSchema.parse(req.body);
        const readStatus = await this.topicStatusService.checkReadStatus(params.topicIds);
        res.json({ success: true, data: { readStatus } });
    }
}
