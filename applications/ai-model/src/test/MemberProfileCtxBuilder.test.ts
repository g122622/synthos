import "reflect-metadata";
import type { AIDigestResult } from "@root/common/contracts/ai-model";

import { describe, it, expect } from "vitest";

import { MemberProfileCtxBuilder } from "../context/ctxBuilders/MemberProfileCtxBuilder";

// 构造测试用 AIDigestResult
const buildDigest = (overrides: Partial<AIDigestResult> = {}): AIDigestResult => ({
    topicId: "topic-1",
    sessionId: "session-1",
    topic: "某话题",
    contributors: JSON.stringify(["张三", "李四"]),
    detail: "话题详情内容",
    modelName: "test-model",
    updateTime: 1000,
    hasEmbedding: true,
    contributorIDs: JSON.stringify(["111", "222"]),
    ...overrides
});

describe("MemberProfileCtxBuilder", () => {
    it("buildCtx 应聚合所有话题的 topic 与 detail 到上下文中", async () => {
        const builder = new MemberProfileCtxBuilder();

        await builder.init();

        const digestResults = [
            buildDigest({ topicId: "t1", topic: "讨论并发模型", detail: "张三分享了并发模型的理解" }),
            buildDigest({ topicId: "t2", topic: "求职经验交流", detail: "李四讲述了秋招经历" })
        ];

        const ctx = await builder.buildCtx("张三", digestResults);

        // 聚合文本应包含每个话题的标题与详情
        expect(ctx).toContain("讨论并发模型");
        expect(ctx).toContain("张三分享了并发模型的理解");
        expect(ctx).toContain("求职经验交流");
        expect(ctx).toContain("李四讲述了秋招经历");
        // 应包含昵称
        expect(ctx).toContain("张三");
    });

    it("buildCtx 应包含六个分析维度的字段名", async () => {
        const builder = new MemberProfileCtxBuilder();

        await builder.init();

        const ctx = await builder.buildCtx("张三", [buildDigest()]);

        expect(ctx).toContain("school");
        expect(ctx).toContain("company");
        expect(ctx).toContain("domain");
        expect(ctx).toContain("experience");
        expect(ctx).toContain("interests");
        expect(ctx).toContain("communicationStyle");
    });

    it("空话题列表时应仍能生成合法上下文（不抛错）", async () => {
        const builder = new MemberProfileCtxBuilder();

        await builder.init();

        const ctx = await builder.buildCtx("张三", []);

        expect(typeof ctx).toBe("string");
        expect(ctx.length).toBeGreaterThan(0);
        expect(ctx).toContain("张三");
    });

    it("聚合应保留话题出现的关键信息（公司名/学校名等）", async () => {
        const builder = new MemberProfileCtxBuilder();

        await builder.init();

        const digestResults = [
            buildDigest({ topic: "公司讨论", detail: "张三提到自己在字节跳动工作" }),
            buildDigest({ topic: "学校讨论", detail: "李四提到毕业于清华大学" })
        ];

        const ctx = await builder.buildCtx("张三", digestResults);

        expect(ctx).toContain("字节跳动");
        expect(ctx).toContain("清华大学");
    });
});
