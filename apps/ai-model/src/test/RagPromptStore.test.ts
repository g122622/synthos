import { describe, it, expect } from "vitest";
import { RagPromptStore } from "../context/prompts/RagPromptStore";

describe("RagPromptStore", () => {
    it("应该能够生成不带日期的 prompt", () => {
        const question = "什么是机器学习？";
        const topics = "话题1内容";
        
        const prompt = RagPromptStore.getRagPrompt(question, topics);
        
        expect(prompt).toContain("你是一个智能助手");
        expect(prompt).toContain(question);
        expect(prompt).toContain(topics);
        expect(prompt).not.toContain("当前日期时间");
    });

    it("应该能够生成带当前日期的 prompt", () => {
        const question = "什么是机器学习？";
        const topics = "话题1内容";
        const currentDate = "2024-01-15-10:30:45";
        
        const prompt = RagPromptStore.getRagPrompt(question, topics, currentDate);
        
        expect(prompt).toContain("你是一个智能助手");
        expect(prompt).toContain(question);
        expect(prompt).toContain(topics);
        expect(prompt).toContain("当前日期时间");
        expect(prompt).toContain(currentDate);
    });
});