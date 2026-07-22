import https from "https";

/**
 * 下载图片，返回原始字节。
 * 支持 301/302/303/307/308 重定向跟随（最多 5 跳），非 2xx 状态码视为失败。
 */
export function downloadImage(url: string, maxRedirects = 5): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        https
            .get(url, res => {
                const { statusCode, headers } = res;

                // 跟随重定向
                if (statusCode && statusCode >= 300 && statusCode < 400 && headers.location && maxRedirects > 0) {
                    // 释放当前响应流，避免句柄泄漏
                    res.resume();
                    const nextUrl = new URL(headers.location, url).href;

                    resolve(downloadImage(nextUrl, maxRedirects - 1));

                    return;
                }

                if (!statusCode || statusCode < 200 || statusCode >= 300) {
                    res.resume();
                    reject(new Error(`HTTP 状态码 ${statusCode}`));

                    return;
                }

                const chunks: Buffer[] = [];

                res.on("data", chunk => chunks.push(chunk));
                res.on("end", () => resolve(Buffer.concat(chunks)));
                res.on("error", reject);
            })
            .on("error", reject);
    });
}
