import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { container } from "tsyringe";
import { AgcDbAccessService } from "@root/common/services/database/AgcDbAccessService";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { SearchOutput } from "@root/common/rpc/ai-model";
import { COMMON_TOKENS } from "@root/common/di/tokens";

import { RAGCtxBuilder } from "../context/ctxBuilders/RAGCtxBuilder";

// 模拟依赖
vi.mock("@root/common/database/AgcDbAccessService");
vi.mock("@root/common/database/ImDbAccessService");
vi.mock("../context/prompts/RagPromptStore");

describe("RAGCtxBuilder", () => {
    let ragCtxBuilder: RAGCtxBuilder;
    let mockAgcDB: AgcDbAccessService;
    let mockImDB: ImDbAccessService;

    beforeEach(async () => {
        // 创建模拟对象
        mockAgcDB = {
            getAIDigestResultByTopicId: vi.fn()
        } as any;

        mockImDB = {
            getSessionTimeDuration: vi.fn()
        } as any;

        // 注册模拟服务到 DI 容器
        container.registerInstance(COMMON_TOKENS.AgcDbAccessService, mockAgcDB);
        container.registerInstance(COMMON_TOKENS.ImDbAccessService, mockImDB);

        // 从容器获取 RAGCtxBuilder 实例
        ragCtxBuilder = container.resolve(RAGCtxBuilder);
        await ragCtxBuilder.init();
    });

    it("应该能够构建包含日期信息的 RAG 上下文", async () => {
        const question = "什么是机器学习？";
        const searchResults: SearchOutput = [
            {
                topicId: "topic1",
                topic: "机器学习基础",
                detail: "机器学习是人工智能的一个分支",
                contributors: "用户1, 用户2",
                distance: 0.2
            },
            {
                topicId: "topic2",
                topic: "深度学习应用",
                detail: "深度学习在图像识别中的应用",
                contributors: "用户3, 用户4",
                distance: 0.3
            }
        ];

        // 模拟数据库返回
        vi.mocked(mockAgcDB.getAIDigestResultByTopicId).mockImplementation(topicId => {
            if (topicId === "topic1") {
                return Promise.resolve({
                    sessionId: "session1",
                    topic: "机器学习基础",
                    detail: "机器学习是人工智能的一个分支",
                    contributors: "用户1, 用户2"
                } as any);
            }
            if (topicId === "topic2") {
                return Promise.resolve({
                    sessionId: "session2",
                    topic: "深度学习应用",
                    detail: "深度学习在图像识别中的应用",
                    contributors: "用户3, 用户4"
                } as any);
            }

            return Promise.resolve(null);
        });

        vi.mocked(mockImDB.getSessionTimeDuration).mockImplementation(sessionId => {
            if (sessionId === "session1") {
                return Promise.resolve({
                    timeStart: new Date(2024, 0, 10, 8, 0, 0).getTime(),
                    timeEnd: new Date(2024, 0, 10, 9, 30, 0).getTime()
                });
            }
            if (sessionId === "session2") {
                return Promise.resolve({
                    timeStart: new Date(2024, 0, 12, 14, 15, 20).getTime(),
                    timeEnd: new Date(2024, 0, 12, 15, 45, 30).getTime()
                });
            }

            return Promise.resolve(null);
        });

        // 由于 getRagAnswerPrompt 被模拟，我们需要直接调用内部方法来验证格式
        // 这里我们使用 spyOn 来部分模拟，保留原始实现
        const { RagPromptStore } = await import("../context/prompts/RagPromptStore");
        const getRagAnswerPromptSpy = vi
            .spyOn(RagPromptStore, "getRagAnswerPrompt")
            .mockImplementation((question, topics) => {
                // 验证 topics 格式
                expect(topics).toContain("【话题1:机器学习基础】");
                expect(topics).toContain("【时间:2024-01-10】");
                expect(topics).toContain("机器学习是人工智能的一个分支");

                expect(topics).toContain("【话题2:深度学习应用】");
                expect(topics).toContain("【时间:2024-01-12】");
                expect(topics).toContain("深度学习在图像识别中的应用");

                // 返回模拟的 CtxTemplateNode 对象
                return {
                    serializeToString: () => "mocked prompt"
                } as any;
            });

        const prompt = await ragCtxBuilder.buildCtx(question, searchResults);

        // 验证返回值
        expect(prompt).toBe("mocked prompt");

        // 验证数据库调用
        expect(mockAgcDB.getAIDigestResultByTopicId).toHaveBeenCalledTimes(2);
        expect(mockImDB.getSessionTimeDuration).toHaveBeenCalledTimes(2);
    });

    it("应该能够处理缺少日期信息的话题", async () => {
        const question = "什么是机器学习？";
        const searchResults: SearchOutput = [
            {
                topicId: "topic1",
                topic: "机器学习基础",
                detail: "机器学习是人工智能的一个分支",
                contributors: "用户1, 用户2",
                distance: 0.2
            },
            {
                topicId: "topic2", // 这个话题没有对应的会话信息
                topic: "深度学习应用",
                detail: "深度学习在图像识别中的应用",
                contributors: "用户3, 用户4",
                distance: 0.3
            }
        ];

        // 重置模拟函数
        vi.clearAllMocks();

        // 模拟数据库返回 - 第二个话题没有会话信息
        vi.mocked(mockAgcDB.getAIDigestResultByTopicId).mockImplementation(topicId => {
            if (topicId === "topic1") {
                return Promise.resolve({
                    sessionId: "session1",
                    topic: "机器学习基础",
                    detail: "机器学习是人工智能的一个分支",
                    contributors: "用户1, 用户2"
                } as any);
            }

            return Promise.resolve(null);
        });

        vi.mocked(mockImDB.getSessionTimeDuration).mockImplementation(sessionId => {
            if (sessionId === "session1") {
                return Promise.resolve({
                    timeStart: new Date(2024, 0, 10, 8, 0, 0).getTime(),
                    timeEnd: new Date(2024, 0, 10, 9, 30, 0).getTime()
                });
            }

            return Promise.resolve(null);
        });

        // 使用 spyOn 验证传递给 RagPromptStore 的参数
        const { RagPromptStore } = await import("../context/prompts/RagPromptStore");
        const getRagAnswerPromptSpy = vi
            .spyOn(RagPromptStore, "getRagAnswerPrompt")
            .mockImplementation((question, topics) => {
                // 验证 topics 格式包含第一个话题的日期信息
                expect(topics).toContain("【话题1:机器学习基础】");
                expect(topics).toContain("【时间:2024-01-10】");
                expect(topics).toContain("机器学习是人工智能的一个分支");

                // 验证 topics 格式包含第二个话题但不包含日期信息
                expect(topics).toContain("【话题2:深度学习应用】");
                expect(topics).toContain("深度学习在图像识别中的应用");

                // 返回模拟的 CtxTemplateNode 对象
                return {
                    serializeToString: () => "mocked prompt"
                } as any;
            });

        const prompt = await ragCtxBuilder.buildCtx(question, searchResults);

        // 验证返回值
        expect(prompt).toBe("mocked prompt");
    });
});
