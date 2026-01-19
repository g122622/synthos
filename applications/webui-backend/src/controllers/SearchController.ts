/**
 * 搜索控制器
 * 处理搜索和问答 API 请求
 */
import { injectable, inject } from "tsyringe";
import { Request, Response } from "express";
import { TOKENS } from "../di/tokens";
import { SearchService } from "../services/SearchService";
import { RagChatHistoryService, type ReferenceItem as RagReferenceItem } from "../services/RagChatHistoryService";
import Logger from "@root/common/util/Logger";
import { RagAskSchema, RagSearchSchema } from "../schemas/index";

@injectable()
export class SearchController {
    private LOGGER = Logger.withTag("SearchController");

    constructor(
        @inject(TOKENS.SearchService) private searchService: SearchService,
        @inject(TOKENS.RagChatHistoryService) private ragChatHistoryService: RagChatHistoryService
    ) {}

    /**
     * 语义搜索
     * POST /api/search
     * Body: { query: string, limit?: number }
     */
    async search(req: Request, res: Response): Promise<void> {
        const params = RagSearchSchema.parse(req.body);
        const results = await this.searchService.search(params.query, params.limit);

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
        const params = RagAskSchema.parse(req.body);
        const question = params.question;
        const resolvedTopK = params.topK;
        const resolvedEnableQueryRewriter = params.enableQueryRewriter;

        const result = await this.searchService.ask(question, resolvedTopK, resolvedEnableQueryRewriter);

        const answer = result.answer;
        const references: RagReferenceItem[] = Array.isArray(
            (result as unknown as { references?: unknown }).references
        )
            ? (result as unknown as { references: RagReferenceItem[] }).references || []
            : [];

        let sessionId: string | undefined;
        try {
            const session = await this.ragChatHistoryService.createSession({
                question,
                answer: answer || "",
                references,
                topK: resolvedTopK,
                enableQueryRewriter: resolvedEnableQueryRewriter
            });
            sessionId = session.id;
        } catch (error) {
            // 不能因为历史记录保存失败而影响问答结果返回
            // 保持与旧前端行为一致：问答成功但不落库
            this.LOGGER.warning(`问答历史记录保存失败，将跳过落库。错误：${error}`);
        }

        res.json({
            success: true,
            data: {
                ...result,
                sessionId
            }
        });
    }
}
