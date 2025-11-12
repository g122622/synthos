import { Request, Response } from "express";
import { BaseHandler } from "./BaseHandler";

export class InterestScoreHandler extends BaseHandler {
    // 这里处理的是post请求
    public async handleGetInterestScoreResults(req: Request, res: Response): Promise<void> {
        try {
            const { topicIds } = req.body;

            if (!topicIds || !Array.isArray(topicIds)) {
                res.status(400).json({ success: false, message: "缺少topicIds参数" });
                return;
            }

            const results = [];
            for (const topicId of topicIds) {
                results.push({
                    topicId,
                    score: await this.interestScoreDBManager!.getInterestScoreResult(topicId)
                });
            }
            res.json({ success: true, data: results });
        } catch (error) {
            this.LOGGER.error(`获取InterestScore结果失败: ${error}`);
            res.status(500).json({ success: false, message: "服务器内部错误" });
        }
    }
}
