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

        const ctx = await builder.buildCtx("张三", "111", ["张三"], digestResults);

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

        const ctx = await builder.buildCtx("张三", "111", ["张三"], [buildDigest()]);

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

        const ctx = await builder.buildCtx("张三", "111", ["张三"], []);

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

        const ctx = await builder.buildCtx("张三", "111", ["张三"], digestResults);

        expect(ctx).toContain("字节跳动");
        expect(ctx).toContain("清华大学");
    });

    it("buildMergeCtx 应把各子画像聚合成汇总上下文", async () => {
        const builder = new MemberProfileCtxBuilder();

        await builder.init();

        const subProfiles = [
            {
                school: "清华大学",
                company: null,
                domain: "分布式系统",
                experience: null,
                interests: "数据库",
                communicationStyle: null
            },
            {
                school: null,
                company: "字节跳动",
                domain: "后端",
                experience: "秋招",
                interests: null,
                communicationStyle: "理性"
            }
        ];

        const ctx = await builder.buildMergeCtx("张三", ["张三"], subProfiles);

        // 应包含昵称
        expect(ctx).toContain("张三");
        // 应包含每份子画像的标识与其字段值
        expect(ctx).toContain("子画像1");
        expect(ctx).toContain("子画像2");
        expect(ctx).toContain("清华大学");
        expect(ctx).toContain("字节跳动");
        // 汇总 prompt 的整合规则与冲突保留要求
        expect(ctx).toContain("整合规则");
        expect(ctx).toContain("冲突");
        // 仍应包含六个分析维度的字段名
        expect(ctx).toContain("school");
        expect(ctx).toContain("company");
        expect(ctx).toContain("domain");
        expect(ctx).toContain("experience");
        expect(ctx).toContain("interests");
        expect(ctx).toContain("communicationStyle");
    });

    it("buildMergeCtx 空子画像列表时应仍能生成合法上下文（不抛错）", async () => {
        const builder = new MemberProfileCtxBuilder();

        await builder.init();

        const ctx = await builder.buildMergeCtx("张三", ["张三"], []);

        expect(typeof ctx).toBe("string");
        expect(ctx.length).toBeGreaterThan(0);
        expect(ctx).toContain("张三");
    });

    it("buildCtx 应把同一人不同时期的昵称都标注为本人，并在 prompt 列出全部已知昵称", async () => {
        const builder = new MemberProfileCtxBuilder();

        await builder.init();

        // 同一 senderId=111，在两个话题中分别以"张三""老张"两个昵称出现（改名场景）
        const digestResults = [
            buildDigest({
                topicId: "t1",
                topic: "并发模型讨论",
                detail: "张三分享了并发模型的理解",
                contributors: JSON.stringify(["张三", "李四"]),
                contributorIDs: JSON.stringify(["111", "222"])
            }),
            buildDigest({
                topicId: "t2",
                topic: "秋招交流",
                detail: "老张讲述了秋招经历",
                contributors: JSON.stringify(["老张", "王五"]),
                contributorIDs: JSON.stringify(["111", "333"])
            })
        ];

        const ctx = await builder.buildCtx("张三", "111", ["张三", "老张"], digestResults);

        // 两个话题的参与者行都应把本人标注出来（不同昵称同一人）
        expect(ctx).toContain("张三（本人）");
        expect(ctx).toContain("老张（本人）");
        // 全部已知昵称都应注入 prompt
        expect(ctx).toContain("张三");
        expect(ctx).toContain("老张");
        // 应包含"均指同一人"的身份提示文案
        expect(ctx).toContain("均指同一人");
    });

    it("buildCtx 在某话题 contributorIDs 缺失/无法对齐时不应崩溃且不标注本人", async () => {
        const builder = new MemberProfileCtxBuilder();

        await builder.init();

        // 第一条话题 contributorIDs 缺失（无法对齐本人）；第二条正常
        const digestResults = [
            buildDigest({
                topicId: "t1",
                topic: "无 ID 的话题",
                detail: "某匿名讨论",
                contributors: JSON.stringify(["张三", "李四"]),
                contributorIDs: JSON.stringify([]) // 空，无法对齐
            }),
            buildDigest({
                topicId: "t2",
                topic: "正常话题",
                detail: "张三分享了经验",
                contributors: JSON.stringify(["张三", "王五"]),
                contributorIDs: JSON.stringify(["111", "333"])
            })
        ];

        const ctx = await builder.buildCtx("张三", "111", ["张三"], digestResults);

        // 不应抛错，仍生成合法上下文
        expect(typeof ctx).toBe("string");
        expect(ctx.length).toBeGreaterThan(0);
        // 第二条话题对齐成功 → 标注本人；第一条因 contributorIDs 为空不标注
        expect(ctx).toContain("张三（本人）");
        // 第一条参与者行应为昵称列表（无（本人）标记），不崩
        expect(ctx).toContain("无 ID 的话题");
    });
});
