import { Request, Response } from "express";
import { BaseHandler } from "./BaseHandler";
import https from "https";

export class MiscHandler extends BaseHandler {
    public handleHealthCheck(_req: Request, res: Response): void {
        res.json({
            success: true,
            message: "WebUI后端服务运行正常",
            timestamp: new Date().toISOString()
        });
    }

    /**
     * 获取QQ号码对应的头像，使用 http://q1.qlogo.cn/g?b=qq&nk=QQ号码&s=100 接口
     * 服务器下载头像之后，返回头像的base64编码
     */
    public async handleGetQQAvatar(req: Request, res: Response): Promise<void> {
        function downloadImage(url: string): Promise<Buffer> {
            return new Promise((resolve, reject) => {
                https
                    .get(url, res => {
                        if (res.statusCode !== 200) {
                            reject(new Error(`HTTP 状态码 ${res.statusCode}`));
                            return;
                        }

                        const chunks: Buffer[] = [];
                        res.on("data", chunk => chunks.push(chunk));
                        res.on("end", () => resolve(Buffer.concat(chunks)));
                    })
                    .on("error", reject);
            });
        }

        try {
            const { qqNumber } = req.query;

            if (!qqNumber || typeof qqNumber !== "string") {
                res.status(400).json({ success: false, message: "缺少qqNumber参数" });
                return;
            }

            const avatarUrl = `http://q1.qlogo.cn/g?b=qq&nk=${qqNumber}&s=100`;
            // 下载
            const avatarBuffer = await downloadImage(avatarUrl);
            const avatarBase64 = avatarBuffer.toString("base64");
            res.json({ success: true, data: { avatarBase64 } });
        } catch (error) {
            this.LOGGER.error(`获取QQ头像失败: ${error}`);
            res.status(500).json({ success: false, message: "服务器内部错误" });
        }
    }
}
