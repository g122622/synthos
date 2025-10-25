import { Request, Response } from "express";
import { BaseHandler } from "./BaseHandler";

export class InterestScoreHandler extends BaseHandler {
    public async handleGetInterestScoreResult(req: Request, res: Response): Promise<void> {
        try {
            const { topicId } = req.query;

            if (!topicId || typeof topicId !== "string") {
                res.status(400).json({ success: false, message: "缺少topicId参数" });
                return;
            }

            const result = await this.interestScoreDBManager!.getInterestScoreResult(topicId);
            if (result) {
                res.json({ success: true, data: result });
            } else {
                res.status(404).json({ success: false, message: "未找到对应的摘要结果" });
            }
        } catch (error) {
            this.LOGGER.error(`获取InterestScore结果失败: ${error}`);
            res.status(500).json({ success: false, message: "服务器内部错误" });
        }
    }

    public async handleCheckInterestScoreResultExist(req: Request, res: Response): Promise<void> {
        try {
            const { topicId } = req.query;

            if (!topicId || typeof topicId !== "string") {
                res.status(400).json({ success: false, message: "缺少topicId参数" });
                return;
            }

            const isExist = await this.interestScoreDBManager!.isInterestScoreResultExist(topicId);
            res.json({ success: true, data: { isExist } });
        } catch (error) {
            this.LOGGER.error(`handleCheckInterestScoreResultExist失败: ${error}`);
            res.status(500).json({ success: false, message: "服务器内部错误" });
        }
    }
}
