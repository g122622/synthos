import { Request, Response } from "express";
import { BaseHandler } from "./BaseHandler";
import { TopicFavoriteStatusManager } from "../repositories/TopicFavoriteStatusManager";
import { TopicReadStatusManager } from "../repositories/TopicReadStatusManager";
import ConfigManagerService from "@root/common/config/ConfigManagerService";
import * as path from "path";

export class TopicStatusHandler extends BaseHandler {
    private favoriteStatusManager: Promise<TopicFavoriteStatusManager>;
    private readStatusManager: Promise<TopicReadStatusManager>;

    constructor(agcDBManager: any, imDBManager: any, interestScoreDBManager: any) {
        super(agcDBManager, imDBManager, interestScoreDBManager);

        this.favoriteStatusManager = new Promise((resolve, reject) => {
            ConfigManagerService.getCurrentConfig()
                .then(config => {
                    resolve(
                        TopicFavoriteStatusManager.getInstance(
                            path.join(config.webUI_Backend.kvStoreBasePath, "favorite_topics")
                        )
                    );
                })
                .catch(reject);
        });

        this.readStatusManager = new Promise((resolve, reject) => {
            ConfigManagerService.getCurrentConfig().then(config => {
                resolve(
                    TopicReadStatusManager.getInstance(
                        path.join(config.webUI_Backend.kvStoreBasePath, "read_topics")
                    )
                );
            });
        });
    }

    /**
     * 标记话题为收藏
     * POST /api/topic/favorite
     * 请求体: { topicId: string }
     */
    public async handleMarkAsFavorite(req: Request, res: Response): Promise<void> {
        try {
            const { topicId } = req.body;

            if (!topicId || typeof topicId !== "string") {
                res.status(400).json({
                    success: false,
                    message: "缺少topicId参数或参数类型不正确"
                });
                return;
            }

            await (await this.favoriteStatusManager).markAsFavorite(topicId);

            res.json({
                success: true,
                message: "话题已标记为收藏"
            });
        } catch (error) {
            this.LOGGER.error(`标记话题为收藏失败: ${error}`);
            res.status(500).json({
                success: false,
                message: "服务器内部错误"
            });
        }
    }

    /**
     * 从收藏中移除话题
     * DELETE /api/topic/favorite
     * 请求体: { topicId: string }
     */
    public async handleRemoveFromFavorites(req: Request, res: Response): Promise<void> {
        try {
            const { topicId } = req.body;

            if (!topicId || typeof topicId !== "string") {
                res.status(400).json({
                    success: false,
                    message: "缺少topicId参数或参数类型不正确"
                });
                return;
            }

            await (await this.favoriteStatusManager).removeFromFavorites(topicId);

            res.json({
                success: true,
                message: "话题已从收藏中移除"
            });
        } catch (error) {
            this.LOGGER.error(`从收藏中移除话题失败: ${error}`);
            res.status(500).json({
                success: false,
                message: "服务器内部错误"
            });
        }
    }

    /**
     * 检查多个话题是否被收藏
     * POST /api/topic/favorite/status
     * 请求体: { topicIds: string[] }
     */
    public async handleCheckFavoriteStatus(req: Request, res: Response): Promise<void> {
        try {
            const { topicIds } = req.body;

            if (!topicIds || !Array.isArray(topicIds)) {
                res.status(400).json({
                    success: false,
                    message: "缺少topicIds参数或参数类型不正确"
                });
                return;
            }

            // 检查每个话题的收藏状态
            const favoriteStatus: Record<string, boolean> = {};
            for (const topicId of topicIds) {
                favoriteStatus[topicId] = await (await this.favoriteStatusManager).isTopicFavorite(topicId);
            }

            res.json({
                success: true,
                data: { favoriteStatus }
            });
        } catch (error) {
            this.LOGGER.error(`检查话题收藏状态失败: ${error}`);
            res.status(500).json({
                success: false,
                message: "服务器内部错误"
            });
        }
    }

    /**
     * 标记话题为已读
     * POST /api/topic/read
     * 请求体: { topicId: string }
     */
    public async handleMarkAsRead(req: Request, res: Response): Promise<void> {
        try {
            const { topicId } = req.body;

            if (!topicId || typeof topicId !== "string") {
                res.status(400).json({
                    success: false,
                    message: "缺少topicId参数或参数类型不正确"
                });
                return;
            }

            await (await this.readStatusManager).markAsRead(topicId);

            res.json({
                success: true,
                message: "话题已标记为已读"
            });
        } catch (error) {
            this.LOGGER.error(`标记话题为已读失败: ${error}`);
            res.status(500).json({
                success: false,
                message: "服务器内部错误"
            });
        }
    }

    /**
     * 清除话题的已读状态
     * DELETE /api/topic/read
     * 请求体: { topicId: string }
     */
    public async handleMarkAsUnread(req: Request, res: Response): Promise<void> {
        try {
            const { topicId } = req.body;

            if (!topicId || typeof topicId !== "string") {
                res.status(400).json({
                    success: false,
                    message: "缺少topicId参数或参数类型不正确"
                });
                return;
            }

            await (await this.readStatusManager).markAsUnread(topicId);

            res.json({
                success: true,
                message: "话题已读状态已清除"
            });
        } catch (error) {
            this.LOGGER.error(`清除话题已读状态失败: ${error}`);
            res.status(500).json({
                success: false,
                message: "服务器内部错误"
            });
        }
    }

    /**
     * 检查多个话题是否已读
     * POST /api/topic/read/status
     * 请求体: { topicIds: string[] }
     */
    public async handleCheckReadStatus(req: Request, res: Response): Promise<void> {
        try {
            const { topicIds } = req.body;

            if (!topicIds || !Array.isArray(topicIds)) {
                res.status(400).json({
                    success: false,
                    message: "缺少topicIds参数或参数类型不正确"
                });
                return;
            }

            // 检查每个话题的已读状态
            const readStatus: Record<string, boolean> = {};
            for (const topicId of topicIds) {
                readStatus[topicId] = await (await this.readStatusManager).isTopicRead(topicId);
            }

            res.json({
                success: true,
                data: { readStatus }
            });
        } catch (error) {
            this.LOGGER.error(`检查话题已读状态失败: ${error}`);
            res.status(500).json({
                success: false,
                message: "服务器内部错误"
            });
        }
    }
}
