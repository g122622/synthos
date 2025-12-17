/**
 * 兴趣度评分服务
 */
import { injectable, inject } from "tsyringe";
import { TOKENS } from "../di/tokens";
import { InterestScoreDBManager } from "@root/common/database/InterestScoreDBManager";

@injectable()
export class InterestScoreService {
    constructor(
        @inject(TOKENS.InterestScoreDBManager) private interestScoreDBManager: InterestScoreDBManager
    ) {}

    /**
     * 根据多个 topicId 获取兴趣度评分结果
     */
    async getInterestScoreResults(topicIds: string[]) {
        const results = [];
        for (const topicId of topicIds) {
            results.push({
                topicId,
                score: await this.interestScoreDBManager.getInterestScoreResult(topicId)
            });
        }
        return results;
    }
}

