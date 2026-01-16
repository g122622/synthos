/**
 * 搜索控制器
 * 处理搜索和问答 API 请求
 */
import { injectable, inject } from "tsyringe";
import { Request, Response } from "express";
import { TOKENS } from "../di/tokens";
import { SearchService } from "../services/SearchService";
import { ValidationError } from "../errors/AppError";

@injectable()
export class SearchController {
    constructor(@inject(TOKENS.SearchService) private searchService: SearchService) {}

    /**
     * 语义搜索
     * POST /api/search
     * Body: { query: string, limit?: number }
     */
    async search(req: Request, res: Response): Promise<void> {
        const { query, limit } = req.body;

        if (!query || typeof query !== "string") {
            throw new ValidationError("query 参数是必需的且必须是字符串");
        }

        const results = await this.searchService.search(query, limit || 10);

        res.json({
            success: true,
            data: results
        });
    }

    /**
     * RAG 问答
     * POST /api/ask
     * Body: { question: string, topK?: number, enableQueryRewriter?: boolean }
     */
    async ask(req: Request, res: Response): Promise<void> {
        const { question, topK, enableQueryRewriter } = req.body;

        if (!question || typeof question !== "string") {
            throw new ValidationError("question 参数是必需的且必须是字符串");
        }

        const result = await this.searchService.ask(
            question,
            topK || 5,
            enableQueryRewriter !== undefined ? enableQueryRewriter : true
        );

        res.json({
            success: true,
            data: result
        });
    }
}
