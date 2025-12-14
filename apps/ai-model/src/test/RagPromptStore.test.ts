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
        expect(prompt).not.toContain("话题时间范围");
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
        expect(prompt).not.toContain("话题时间范围");
    });

    it("应该能够生成带话题日期的 prompt", () => {
        const question = "什么是机器学习？";
        const topics = "话题1内容";
        const topicDates = {
            "1": { startTime: "2024-01-10-08:00:00", endTime: "2024-01-10-09:30:00" }
        };
        
        const prompt = RagPromptStore.getRagPrompt(question, topics, undefined, topicDates);
        
        expect(prompt).toContain("你是一个智能助手");
        expect(prompt).toContain(question);
        expect(prompt).toContain(topics);
        expect(prompt).not.toContain("当前日期时间");
        expect(prompt).toContain("话题时间范围");
        expect(prompt).toContain("话题1: 2024-01-10-08:00:00 至 2024-01-10-09:30:00");
    });

    it("应该能够生成带当前日期和话题日期的 prompt", () => {
        const question = "什么是机器学习？";
        const topics = "话题1内容\n话题2内容";
        const currentDate = "2024-01-15-10:30:45";
        const topicDates = {
            "1": { startTime: "2024-01-10-08:00:00", endTime: "2024-01-10-09:30:00" },
            "2": { startTime: "2024-01-12-14:15:20", endTime: "2024-01-12-15:45:30" }
        };
        
        const prompt = RagPromptStore.getRagPrompt(question, topics, currentDate, topicDates);
        
        expect(prompt).toContain("你是一个智能助手");
        expect(prompt).toContain(question);
        expect(prompt).toContain(topics);
        expect(prompt).toContain("当前日期时间");
        expect(prompt).toContain(currentDate);
        expect(prompt).toContain("话题时间范围");
        expect(prompt).toContain("话题1: 2024-01-10-08:00:00 至 2024-01-10-09:30:00");
        expect(prompt).toContain("话题2: 2024-01-12-14:15:20 至 2024-01-12-15:45:30");
        expect(prompt).toContain("考虑话题发生的时间背景");
        expect(prompt).toContain("请注意话题发生的时间，考虑时效性对回答的影响");
    });
});