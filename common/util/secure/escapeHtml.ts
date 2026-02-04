/**
 * HTML 转义工具函数
 * 将特殊字符转换为 HTML 实体，防止 XSS 攻击
 * @param text 原始文本
 * @param options 转义选项
 * @returns 转义后的文本
 */
export function escapeHtml(text: string, options?: { preserveNewlines?: boolean }): string {
    const escapeMap: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    };

    let result = text;

    // 先转义特殊字符
    for (const [char, escaped] of Object.entries(escapeMap)) {
        result = result.split(char).join(escaped);
    }

    // 可选：将换行符转换为 <br> 标签
    if (options?.preserveNewlines) {
        result = result.split("\n").join("<br>");
    }

    return result;
}
