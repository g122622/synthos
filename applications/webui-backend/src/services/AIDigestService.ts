/**
 * AI 摘要服务
 */
import { injectable, inject } from "tsyringe";
import { TOKENS } from "../di/tokens";
import { AGCDBManager } from "@root/common/database/AGCDBManager";
import { NotFoundError } from "../errors/AppError";

@injectable()
export class AIDigestService {
    constructor(@inject(TOKENS.AGCDBManager) private agcDBManager: AGCDBManager) {}

    /**
     * 根据 topicId 获取 AI 摘要结果
     */
    async getAIDigestResultByTopicId(topicId: string) {
        const result = await this.agcDBManager.getAIDigestResultByTopicId(topicId);
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
                result: await this.agcDBManager.getAIDigestResultsBySessionId(sessionId)
            });
        }
        return results;
    }

    /**
     * 检查会话是否已被摘要
     */
    async isSessionSummarized(sessionId: string): Promise<boolean> {
        return await this.agcDBManager.isSessionIdSummarized(sessionId);
    }
}
