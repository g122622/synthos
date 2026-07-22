/**
 * 杂项控制器
 */
import { Request, Response } from "express";
import { injectable, inject } from "tsyringe";

import { TOKENS } from "../di/tokens";
import { MiscService } from "../services/MiscService";
import { GetQQAvatarSchema } from "../schemas/index";

@injectable()
export class MiscController {
    constructor(@inject(TOKENS.MiscService) private miscService: MiscService) {}

    /**
     * GET /health
     */
    healthCheck(_req: Request, res: Response): void {
        const healthInfo = this.miscService.getHealthInfo();

        res.json({ success: true, ...healthInfo });
    }

    /**
     * GET /api/qq-avatar?type=group|user&qqId=xxx
     * 返回头像图片字节，由后端统一回源腾讯并做磁盘缓存。
     * 返回失败（如回源 404）时以 404 JSON 响应，由前端 onError 兜底占位图。
     */
    async getQQAvatar(req: Request, res: Response): Promise<void> {
        const { type, qqId } = GetQQAvatarSchema.parse(req.query);
        const { buffer, contentType } = await this.miscService.getQQAvatarImage(type, qqId);

        res.setHeader("Content-Type", contentType);
        // 浏览器侧缓存 1 天，减少重复请求
        res.setHeader("Cache-Control", "public, max-age=86400");
        res.end(buffer);
    }
}
