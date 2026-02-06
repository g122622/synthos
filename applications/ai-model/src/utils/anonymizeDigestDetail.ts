import { AIDigestResult } from "@root/common/contracts/ai-model";

/**
 * 数据清洗函数：
 * 在将 `AIDigestResult` 传给嵌入模型前，自动将 `detail` 字段中的群昵称替换为"用户1"、"用户2"……，
 * 从而消除具体昵称对嵌入语义的干扰，同时保留发言结构。可确保嵌入向量聚焦于**语义内容本身**，而非用户身份信息。
 * 该函数基于 `contributors` 中的昵称顺序进行一一映射替换，并使用**安全的字符串转义**（防止正则注入）。
 * 将 AIDigestResult 的 detail 字段中的具体昵称替换为"用户1"、"用户2"等泛化标识
 *
 * @param digest - 原始摘要结果
 * @returns 替换后的副本（不修改原对象）
 */
export function anonymizeDigestDetail(digest: AIDigestResult): AIDigestResult {
    const { contributors: contributorsStr, detail, ...rest } = digest;

    // 安全解析 contributors 字符串
    let contributors: string[] = [];

    try {
        const parsed = JSON.parse(contributorsStr);

        if (Array.isArray(parsed)) {
            // 过滤出非空字符串的有效昵称
            contributors = parsed.filter((item): item is string => typeof item === "string" && item.trim() !== "");
        }
    } catch {
        // 如果解析失败，视为无有效参与者
        contributors = [];
    }

    if (contributors.length === 0 || !detail) {
        // 无法解析或无详情，直接返回原对象副本（保留原始 contributors 字符串）
        return { ...digest };
    }

    // 构建昵称到泛化标签的映射
    const nicknameToPlaceholder: Record<string, string> = {};

    contributors.forEach((nickname, index) => {
        nicknameToPlaceholder[nickname] = `用户${index + 1}`;
    });

    // 使用逐字替换方式处理复杂昵称，避免正则表达式转义问题
    let anonymizedDetail = detail;

    // 按长度降序排序，确保长昵称优先匹配（避免部分匹配）
    const sortedNicknames = [...contributors].sort((a, b) => b.length - a.length);

    for (const nickname of sortedNicknames) {
        // 使用全局字符串替换，避免正则表达式问题
        const placeholder = nicknameToPlaceholder[nickname];

        if (placeholder) {
            // 使用 split/join 方法进行替换，避免正则表达式的问题
            anonymizedDetail = anonymizedDetail.split(nickname).join(placeholder);
        }
    }

    // 注意：contributors 字段仍保持为原始 JSON 字符串（不改变接口结构）
    return {
        ...rest,
        contributors: contributorsStr,
        detail: anonymizedDetail
    };
}
