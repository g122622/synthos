import { Notification } from "./Notification";

export default async function fetchWrapper(url: string, options?: RequestInit) {
    try {
        const res = await fetch(url, {
            ...options,
            headers: {
                // 先展开用户传入的 headers
                ...(options?.headers || {}),
                // 再添加/覆盖自定义 header
                "ngrok-skip-browser-warning": "69420"
            }
        });

        return res;
    } catch (error: any) {
        Notification.error({
            title: "请求失败",
            description: "地址：" + (url || "未知地址") + " 错误：" + (error.message || "未知错误")
        });
        throw error;
    }
}
