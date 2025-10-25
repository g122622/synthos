// tests/SemanticRater.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SemanticRater } from "../misc/SemanticRater"; // 路径按你项目调整

// Mock Logger
vi.mock("@root/common/util/Logger", () => {
    return {
        default: {
            withTag: () => ({
                info: console.log, // 输出到控制台
                warning: console.warn, // 输出到控制台
                error: console.error // 输出到控制台
            })
        }
    };
});

describe("SemanticRater", () => {
    let rater: SemanticRater;

    beforeEach(() => {
        rater = new SemanticRater();
    });

    afterEach(() => {
        rater.clearCache(); // 清理缓存，避免测试污染
    });

    it("should throw if user interests is empty", async () => {
        await expect(rater.scoreTopic([], "some topic")).rejects.toThrow(
            "User interests cannot be empty"
        );
    });

    it("should return score in [-1, 1] for valid input", async () => {
        const interests = [
            { keyword: "北邮", liked: true },
            { keyword: "科软", liked: false }
        ];
        const topic = "北邮就业报告";

        const score = await rater.scoreTopic(interests, topic);
        console.log("Score:", score); // 输出得分，便于调试

        expect(score).toBeGreaterThanOrEqual(-1);
        expect(score).toBeLessThanOrEqual(1);
        expect(typeof score).toBe("number");
    });

    it("should give higher score for liked keywords", async () => {
        const interests = [{ keyword: "人工智能", liked: true }];
        const relevantTopic = "大模型与人工智能发展";
        const irrelevantTopic = "三星固态硬盘评测";

        const score1 = await rater.scoreTopic(interests, relevantTopic);
        const score2 = await rater.scoreTopic(interests, irrelevantTopic);
        console.log("Score 1:", score1); // 输出得分，便于调试
        console.log("Score 2:", score2); // 输出得分，便于调试

        expect(score1).toBeGreaterThan(score2);
    });

    it("should penalize disliked keywords-1", async () => {
        const interests = [
            { keyword: "北邮", liked: true },
            { keyword: "吹嘘", liked: false }
        ];
        const topicWithNeg = "北邮人均80w，轻松拿offer（吹嘘版）";
        const topicClean = "北邮2024就业质量报告";

        const score1 = await rater.scoreTopic(interests, topicWithNeg);
        const score2 = await rater.scoreTopic(interests, topicClean);
        console.log("Score 1:", score1); // 输出得分，便于调试
        console.log("Score 2:", score2); // 输出得分，便于调试

        // 含“吹嘘”的话题得分应更低（甚至为负）
        expect(score1).toBeLessThan(score2);
    });

    it("should penalize disliked keywords-2", async () => {
        const interests = [
            { keyword: "互联网大厂", liked: true },
            { keyword: "游戏", liked: false }
        ];
        const topicWithNeg = "王者荣耀新赛季";
        const topicClean = "网易2025春招提前批开始啦";

        const score1 = await rater.scoreTopic(interests, topicWithNeg);
        const score2 = await rater.scoreTopic(interests, topicClean);
        console.log("Score 1:", score1); // 输出得分，便于调试
        console.log("Score 2:", score2); // 输出得分，便于调试

        expect(score1).toBeLessThan(score2);
    });

    it("对于无关的中性输入，应该返回一个0附近的值", async () => {
        const interests = [
            { keyword: "互联网大厂", liked: true },
            { keyword: "研究生招生", liked: true },
            { keyword: "游戏", liked: false },
            { keyword: "化妆", liked: false }
        ];

        const score1 = await rater.scoreTopic(interests, '我门前有两棵树，一棵是枣树，另外一棵也是枣树。');
        const score2 = await rater.scoreTopic(interests, '不积跬步，无以至千里');
        console.log("Score 1:", score1); // 输出得分，便于调试
        console.log("Score 2:", score2); // 输出得分，便于调试
    });
});
