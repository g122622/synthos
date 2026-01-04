/**
 * AI 摘要服务
 */
import { injectable, inject } from "tsyringe";
import { TOKENS } from "../di/tokens";
import { AgcDbAccessService} from "@root/common/services/database/AgcDbAccessService";
import { NotFoundError } from "../errors/AppError";

@injectable()
export class AIDigestService {
    constructor(@inject(TOKENS.AgcDbAccessService) private agcDbAccessService: AgcDbAccessService) {}

    /**
     * 根据 topicId 获取 AI 摘要结果
     */
    async getAIDigestResultByTopicId(topicId: string) {
        const result = await this.agcDbAccessService.getAIDigestResultByTopicId(topicId);
        if (!result) {
            throw new NotFoundError("未找到对应的摘要结果");
        }
        return result;
    }

    /**
     * 根据多个 sessionId 获取 AI 摘要结果
     */
    async getAIDigestResultsBySessionIds(sessionIds: string[]) {
        const results = [];
        for (const sessionId of sessionIds) {
            results.push({
                sessionId,
                result: await this.agcDbAccessService.getAIDigestResultsBySessionId(sessionId)
            });
        }
        return results;
    }

    /**
     * 检查会话是否已被摘要
     */
    async isSessionSummarized(sessionId: string): Promise<boolean> {
        return await this.agcDbAccessService.isSessionIdSummarized(sessionId);
    }
}
