// tests/SemanticRater.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SemanticRater } from "../misc/SemanticRater";
import { OllamaEmbeddingService } from "../embedding/OllamaEmbeddingService";

// Mock Logger
vi.mock("@root/common/util/Logger", () => {
    return {
        default: {
            withTag: () => ({
                debug: console.log,
                info: console.log,
                warning: console.warn,
                error: console.error
            })
        }
    };
});

// 简单的模拟向量生成：基于文本内容生成一个确定性的向量
const generateMockVector = (text: string): Float32Array => {
    const vector = new Float32Array(1024);
    // 基于文本生成确定性向量，相似文本会有相似的向量
    for (let i = 0; i < text.length && i < 1024; i++) {
        vector[i] = text.charCodeAt(i) / 65536;
    }
    // L2 归一化
    let norm = 0;
    for (let i = 0; i < vector.length; i++) {
        norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
        for (let i = 0; i < vector.length; i++) {
            vector[i] /= norm;
        }
    }
    return vector;
};

// 用于跟踪 embed 调用次数的计数器
let embedCallCount = 0;

// Mock OllamaEmbeddingService
vi.mock("../embedding/OllamaEmbeddingService", () => {
    return {
        OllamaEmbeddingService: class MockOllamaEmbeddingService {
            constructor(_baseUrl: string, _model: string, _dimension: number) {
                // 构造函数不需要实际逻辑
            }

            async embed(text: string): Promise<Float32Array> {
                embedCallCount++;
                return generateMockVector(text);
            }
        }
    };
});

describe("SemanticRater", () => {
    let rater: SemanticRater;
    let mockEmbeddingService: OllamaEmbeddingService;

    const TEST_BASE_URL = "http://localhost:11434";
    const TEST_MODEL = "bge-m3";
    const TEST_DIMENSION = 1024;

    beforeEach(() => {
        embedCallCount = 0; // 重置计数器
        mockEmbeddingService = new OllamaEmbeddingService(TEST_BASE_URL, TEST_MODEL, TEST_DIMENSION);
        rater = new SemanticRater(mockEmbeddingService);
    });

    afterEach(() => {
        rater.clearCache();
    });

    it("should throw if user interests is empty", async () => {
        await expect(rater.scoreTopic([], "some topic")).rejects.toThrow("User interests cannot be empty");
    });

    it("should return score in [-1, 1] for valid input", async () => {
        const interests = [
            { keyword: "北邮", liked: true },
            { keyword: "科软", liked: false }
        ];
        const topic = "北邮就业报告";

        const score = await rater.scoreTopic(interests, topic);
        console.log("Score:", score);

        expect(score).toBeGreaterThanOrEqual(-1);
        expect(score).toBeLessThanOrEqual(1);
        expect(typeof score).toBe("number");
    });

    it("should call embed method for each unique text", async () => {
        const interests = [{ keyword: "人工智能", liked: true }];
        const topic = "大模型与人工智能发展";

        await rater.scoreTopic(interests, topic);

        // 应该调用 embed 两次：一次为 topic，一次为 keyword（带前缀）
        expect(embedCallCount).toBe(2);
    });

    it("should use cache for repeated texts", async () => {
        const interests = [{ keyword: "人工智能", liked: true }];
        const topic = "大模型与人工智能发展";

        await rater.scoreTopic(interests, topic);
        await rater.scoreTopic(interests, topic);

        // 由于缓存，embed 只应该被调用两次（第一次调用时）
        expect(embedCallCount).toBe(2);
    });

    it("should clear cache when clearCache is called", async () => {
        const interests = [{ keyword: "人工智能", liked: true }];
        const topic = "大模型与人工智能发展";

        await rater.scoreTopic(interests, topic);
        rater.clearCache();
        await rater.scoreTopic(interests, topic);

        // 清理缓存后，embed 应该再次被调用
        expect(embedCallCount).toBe(4);
    });

    it("should handle multiple topics with scoreTopics", async () => {
        const interests = [
            { keyword: "人工智能", liked: true },
            { keyword: "游戏", liked: false }
        ];
        const topics = ["AI发展", "游戏测评", "技术博客"];

        const scores = await rater.scoreTopics(interests, topics);
        console.log("Scores:", scores);

        expect(scores.length).toBe(3);
        scores.forEach(score => {
            expect(score).toBeGreaterThanOrEqual(-1);
            expect(score).toBeLessThanOrEqual(1);
        });
    });

    it("should handle only positive keywords", async () => {
        const interests = [
            { keyword: "北邮", liked: true },
            { keyword: "就业", liked: true }
        ];
        const topic = "北邮就业报告";

        const score = await rater.scoreTopic(interests, topic);
        console.log("Score (only positive):", score);

        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
    });

    it("should handle only negative keywords", async () => {
        const interests = [
            { keyword: "游戏", liked: false },
            { keyword: "娱乐", liked: false }
        ];
        const topic = "游戏测评";

        const score = await rater.scoreTopic(interests, topic);
        console.log("Score (only negative):", score);

        expect(score).toBeGreaterThanOrEqual(-1);
        expect(score).toBeLessThanOrEqual(0);
    });
});
