/**
 * AI 摘要控制器
 */
import { Request, Response } from "express";
import { injectable, inject } from "tsyringe";
import { TOKENS } from "../di/tokens";
import { AIDigestService } from "../services/AIDigestService";
import {
    GetAIDigestResultByTopicIdSchema,
    GetAIDigestResultsBySessionIdsSchema,
    CheckSessionSummarizedSchema
} from "../schemas/index";

@injectable()
export class AIDigestController {
    constructor(
        @inject(TOKENS.AIDigestService) private aiDigestService: AIDigestService
    ) {}

    /**
     * GET /api/ai-digest-result-by-topic-id
     */
    async getAIDigestResultByTopicId(req: Request, res: Response): Promise<void> {
        const params = GetAIDigestResultByTopicIdSchema.parse(req.query);
        const result = await this.aiDigestService.getAIDigestResultByTopicId(params.topicId);
        res.json({ success: true, data: result });
    }

    /**
     * POST /api/ai-digest-results-by-session-ids
     */
    async getAIDigestResultsBySessionIds(req: Request, res: Response): Promise<void> {
        const params = GetAIDigestResultsBySessionIdsSchema.parse(req.body);
        const results = await this.aiDigestService.getAIDigestResultsBySessionIds(params.sessionIds);
        res.json({ success: true, data: results });
    }

    /**
     * GET /api/is-session-summarized
     */
    async checkSessionSummarized(req: Request, res: Response): Promise<void> {
        const params = CheckSessionSummarizedSchema.parse(req.query);
        const isSummarized = await this.aiDigestService.isSessionSummarized(params.sessionId);
        res.json({ success: true, data: { isSummarized } });
    }
}

