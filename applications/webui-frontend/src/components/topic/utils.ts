// 解析contributors字符串为数组
const parseContributors = (contributorsStr: string): string[] => {
    try {
        const parsed = JSON.parse(contributorsStr);

        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error("解析参与者失败:", error);

        return [];
    }
};

// 解析contributorIDs字符串为QQ号数组（与contributors昵称数组一一对应，未命中位置为空串）
const parseContributorIDs = (contributorIDsStr?: string): string[] => {
    try {
        if (!contributorIDsStr) return [];
        const parsed = JSON.parse(contributorIDsStr);

        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error("解析参与者QQ号失败:", error);

        return [];
    }
};

// 将昵称数组与QQ号数组按下标对齐为 昵称→QQ号 映射；空QQ号不入映射
const zipContributorsWithIds = (names: string[], ids: string[]): Map<string, string> => {
    const map = new Map<string, string>();

    for (let i = 0; i < names.length; i++) {
        const id = ids[i] ?? "";

        if (id) {
            map.set(names[i], id);
        }
    }

    return map;
};

// 根据兴趣得分生成颜色
const generateColorFromInterestScore = (interestScore: number, shouldContainAlpha: boolean = true): string => {
    interestScore *= 4; // 放大，让效果更明显

    // 将 score 映射到 [0, 120] 的 hue 值：-1 → 0°（红），0 → 60°（黄），1 → 120°（绿）
    const hue = 60 + 60 * interestScore; // score ∈ [-1, 1] → hue ∈ [0, 120]

    if (!shouldContainAlpha) {
        return `hsl(${hue}, 90%, 40%)`;
    }

    return `hsla(${hue}, 90%, 40%, 0.1)`;
};

export { parseContributors, parseContributorIDs, zipContributorsWithIds, generateColorFromInterestScore };
