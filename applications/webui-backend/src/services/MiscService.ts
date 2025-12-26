/**
 * 杂项服务
 */
import { injectable } from "tsyringe";
import https from "https";

@injectable()
export class MiscService {
    /**
     * 获取健康检查信息
     */
    getHealthInfo() {
        return {
            message: "WebUI后端服务运行正常",
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 下载 QQ 头像并返回 base64 编码
     */
    async getQQAvatarBase64(qqNumber: string): Promise<string> {
        const avatarUrl = `https://q1.qlogo.cn/g?b=qq&nk=${qqNumber}&s=100`;
        const avatarBuffer = await this.downloadImage(avatarUrl);
        return avatarBuffer.toString("base64");
    }

    /**
     * 下载图片
     */
    private downloadImage(url: string): Promise<Buffer> {
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
}
