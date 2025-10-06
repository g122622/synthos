/**
 * 构建请求URL的工具类
 * 使用示例：
 * const builder = new RequestURLBuilder("https://api.example.com");
 * const fullUrl = builder.buildUrl("/users", { page: 1, limit: 10 });
 * console.log(fullUrl); // 输出: https://api.example.com/users?page=1&limit=10
 */
class RequestURLBuilder {
    private baseUrl: string;

    constructor(baseUrl: string) {
        // 确保baseUrl以'/'结尾，如果没有则添加
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
    }

    public buildUrl(path: string, queryParams?: { [key: string]: string | number | boolean }): string {
        // 处理path，确保不以'/'开头，如果baseUrl已经以'/'结尾了
        let url = this.baseUrl + (path.startsWith("/") ? path.substring(1) : path);
        // 确保path不以'/'结尾
        if (url.endsWith("/")) {
            url = url.substring(0, url.length - 1);
        }

        // 如果有查询参数，将它们添加到URL中
        if (queryParams && Object.keys(queryParams).length > 0) {
            const queryStrings = new URLSearchParams();
            for (const key of Object.keys(queryParams)) {
                queryStrings.append(key, String(queryParams[key]));
            }
            url += "?" + queryStrings.toString();
        }

        return url;
    }
}

export default RequestURLBuilder;


