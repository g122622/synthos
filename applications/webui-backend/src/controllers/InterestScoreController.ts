/**
 * 兴趣度评分控制器
 */
import { Request, Response } from "express";
import { injectable, inject } from "tsyringe";

import { TOKENS } from "../di/tokens";
import { InterestScoreService } from "../services/InterestScoreService";
import { GetInterestScoreResultsSchema } from "../schemas/index";

@injectable()
export class InterestScoreController {
    constructor(@inject(TOKENS.InterestScoreService) private interestScoreService: InterestScoreService) {}

    /**
     * POST /api/interest-score-results
     */
    async getInterestScoreResults(req: Request, res: Response): Promise<void> {
        const params = GetInterestScoreResultsSchema.parse(req.body);
        const results = await this.interestScoreService.getInterestScoreResults(params.topicIds);

        res.json({ success: true, data: results });
    }
}
