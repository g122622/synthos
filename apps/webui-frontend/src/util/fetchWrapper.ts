export default function fetchWrapper(url: string, options?: RequestInit) {
    return fetch(url, {
        ...options,
        headers: {
            // 先展开用户传入的 headers
            ...(options?.headers || {}),
            // 再添加/覆盖自定义 header
            "ngrok-skip-browser-warning": "69420"
        }
    });
}
