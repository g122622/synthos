/**
 * 群友画像控制器
 * 处理画像缓存查询、依据话题反查、画像生成（普通 POST）
 */
import { Request, Response } from "express";
import { injectable, inject } from "tsyringe";

import { TOKENS } from "../di/tokens";
import { MemberProfileService } from "../services/MemberProfileService";
import { GetMemberProfileSchema, GenerateMemberProfileSchema } from "../schemas/index";

@injectable()
export class MemberProfileController {
    constructor(@inject(TOKENS.MemberProfileService) private memberProfileService: MemberProfileService) {}

    /**
     * GET /api/member-profile
     * 根据 QQ号 查询缓存画像
     */
    public async getMemberProfile(req: Request, res: Response): Promise<void> {
        const params = GetMemberProfileSchema.parse(req.query);
        const profile = await this.memberProfileService.getMemberProfile(params.senderId);

        res.json({ success: true, data: profile });
    }

    /**
     * GET /api/member-profile/topics
     * 根据 QQ号 反查该群友参与的所有话题（画像依据）
     */
    public async getContributorTopics(req: Request, res: Response): Promise<void> {
        const params = GetMemberProfileSchema.parse(req.query);
        const topics = await this.memberProfileService.getContributorTopics(params.senderId);

        res.json({ success: true, data: topics });
    }

    /**
     * POST /api/member-profile/generate
     * 群友画像生成（非流式，直接返回完整画像）
     */
    public async generate(req: Request, res: Response): Promise<void> {
        const params = GenerateMemberProfileSchema.parse(req.body);
        const result = await this.memberProfileService.generateMemberProfile({
            senderId: params.senderId,
            nickname: params.nickname
        });

        // 成功返回落库的画像记录；失败返回 message
        if (result.success) {
            res.json({ success: true, data: result.memberProfile ?? null, message: result.message });
        } else {
            res.json({ success: false, data: null, message: result.message ?? "画像生成失败" });
        }
    }
}
