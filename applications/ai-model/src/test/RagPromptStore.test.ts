import { describe, it, expect } from "vitest";
import { RagPromptStore } from "../context/prompts/RagPromptStore";
import "../context/middleware/registerAll";

describe("RagPromptStore", async () => {
    it("应该能够生成带当前日期的 prompt", async () => {
        const question = "什么是机器学习？";
        const topics = "话题1内容";

        const prompt = (await RagPromptStore.getRagAnswerPrompt(question, topics)).serializeToString();
        expect(prompt).toContain("你是一个智能助手");
        expect(prompt).toContain(question);
        expect(prompt).toContain(topics);
        expect(prompt).toContain("当前日期时间");
    });
});
