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
     * GET /api/qq-avatar
     */
    async getQQAvatar(req: Request, res: Response): Promise<void> {
        const params = GetQQAvatarSchema.parse(req.query);
        const avatarBase64 = await this.miscService.getQQAvatarBase64(params.qqNumber);
        res.json({ success: true, data: { avatarBase64 } });
    }
}
