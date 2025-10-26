import * as http from "http";

// 通过向 Google 的网络连通性检测端点发起 HTTP 请求进行判断。
// 重庆大学校园网环境下可能无法正常工作，此时应使用 checkConnectivityV2 方法。
async function checkConnectivityV1(timeout: number = 5000): Promise<boolean> {
    return new Promise<boolean>(resolve => {
        const url = "http://connectivitycheck.gstatic.com/generate_204";

        const req = http.get(url, res => {
            // Google 的该端点应返回 204 No Content
            resolve(res.statusCode === 204);
        });

        // 设置请求超时
        req.setTimeout(timeout, () => {
            req.destroy();
            resolve(false);
        });

        // 捕获请求错误（如 DNS 失败、连接拒绝、无网络等）
        req.on("error", () => {
            resolve(false);
        });
    });
}

async function checkConnectivityV2(timeout: number = 5000): Promise<boolean> {
    return new Promise<boolean>(resolve => {
        const url = "http://www.msftconnecttest.com/connecttest.txt";
        const req = http.get(url, res => {
            // Microsoft 的该端点应返回"Microsoft Connect Test"
            if (res.statusCode === 200) {
                let data = "";
                res.on("data", chunk => {
                    data += chunk;
                });
                res.on("end", () => {
                    resolve(data.includes("Microsoft Connect Test"));
                });
            }
        });

        req.setTimeout(timeout, () => {
            req.destroy();
            resolve(false);
        });

        req.on("error", () => {
            resolve(false);
        });
    });
}

/**
 * 检测当前设备是否能够访问互联网。
 * @param timeout - 请求超时时间（毫秒），默认为 5000ms
 * @returns Promise<boolean> - 若成功收到 204 响应则返回 true，否则返回 false
 */
export async function checkConnectivity(timeout: number = 5000): Promise<boolean> {
    // v1和v2只要有一个成功即可
    try {
        return (await checkConnectivityV1(timeout)) || (await checkConnectivityV2(timeout));
    } catch (error) {
        console.error("网络连通性检查失败:", error);
        return false;
    }
}

// 示例用法
// import { checkConnectivity } from "./network-utils";

// (async () => {
//     const online = await checkConnectivity();
//     console.log("当前是否联网:", online);
// })();
