import { Request, Response } from "express";
import { BaseHandler } from "./BaseHandler";
import ConfigManagerService from "@root/common/config/ConfigManagerService";

export class GroupConfigHandler extends BaseHandler {
    public async handleGetAllGroupDetails(_req: Request, res: Response): Promise<void> {
        try {
            const groupConfigs = (await ConfigManagerService.getCurrentConfig()).groupConfigs;
            res.json({ success: true, data: groupConfigs });
        } catch (error) {
            this.LOGGER.error(`获取所有群组详情失败: ${error}`);
            res.status(500).json({ success: false, message: "服务器内部错误" });
        }
    }
}
