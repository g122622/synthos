/**
 * 判断一个字符串是否"像 QQ 号"（纯数字）
 *
 * 用于头像展示守卫：避免非数字的 senderId（如临时账号 ID）拼出无效的 QQ 头像 URL。
 */
export const isLikelyQQId = (value: string): boolean => {
    if (!value) {
        return false;
    }

    const trimmed = value.trim();

    if (trimmed.length === 0) {
        return false;
    }

    for (let i = 0; i < trimmed.length; i++) {
        const code = trimmed.charCodeAt(i);

        if (code < 48 || code > 57) {
            return false;
        }
    }

    return true;
};
