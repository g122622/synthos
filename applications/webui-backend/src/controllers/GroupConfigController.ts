/**
 * 群组配置控制器
 */
import { Request, Response } from "express";
import { injectable, inject } from "tsyringe";
import { TOKENS } from "../di/tokens";
import { GroupConfigService } from "../services/GroupConfigService";

@injectable()
export class GroupConfigController {
    constructor(
        @inject(TOKENS.GroupConfigService) private groupConfigService: GroupConfigService
    ) {}

    /**
     * GET /api/group-details
     */
    async getAllGroupDetails(_req: Request, res: Response): Promise<void> {
        const groupConfigs = await this.groupConfigService.getAllGroupDetails();
        res.json({ success: true, data: groupConfigs });
    }
}
