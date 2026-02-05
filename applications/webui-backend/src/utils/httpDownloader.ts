import https from "https";

export function downloadImage(url: string): Promise<Buffer> {
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
