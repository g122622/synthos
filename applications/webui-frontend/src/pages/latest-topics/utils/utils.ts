// 创建一个函数来解析contributors字符串为数组
const parseContributors = (contributorsStr: string): string[] => {
    try {
        const parsed = JSON.parse(contributorsStr);

        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error("解析参与者失败:", error);

        return [];
    }
};

// // 创建一个函数为每个参与者生成专属颜色
// const generateColorFromName = (name: string, shouldContainAlpha: boolean = true): string => {
//     let hash = 0;

//     for (let i = 0; i < name.length; i++) {
//         hash = name.charCodeAt(i) + ((hash << 5) - hash);
//     }

//     // 将哈希值转换为HSL颜色值，增加透明度(0.7)
//     const hue = Math.abs(hash % 360);

//     if (!shouldContainAlpha) {
//         return `hsl(${hue}, 56%, 56%)`;
//     }

//     return `hsla(${hue}, 70%, 40%, 0.1)`;
// };

// 生成基于名称的颜色
const generateColorFromName = (name: string, isBackground: boolean = true): string => {
    const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8", "#FFD700", "#F8B500", "#6C5CE7"];

    let hash = 0;

    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % colors.length;

    return isBackground ? colors[index] + "20" : colors[index];
};

const generateColorFromInterestScore = (interestScore: number, shouldContainAlpha: boolean = true): string => {
    interestScore *= 4; // 放大，让效果更明显

    // 将 score 映射到 [0, 120] 的 hue 值：-1 → 0°（红），0 → 60°（黄），1 → 120°（绿）
    const hue = 60 + 60 * interestScore; // score ∈ [-1, 1] → hue ∈ [0, 120]

    if (!shouldContainAlpha) {
        return `hsl(${hue}, 90%, 40%)`;
    }

    return `hsla(${hue}, 90%, 40%, 0.1)`;
};

export { parseContributors, generateColorFromName, generateColorFromInterestScore };
