// tests/SemanticRater.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SemanticRater } from "../misc/SemanticRater";
import { OllamaEmbeddingService } from "../services/embedding/OllamaEmbeddingService";

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

// 用于跟踪 embedBatch 调用次数的计数器
let embedBatchCallCount = 0;
let embedBatchTextCount = 0;

// Mock OllamaEmbeddingService
vi.mock("../embedding/OllamaEmbeddingService", () => {
    return {
        OllamaEmbeddingService: class MockOllamaEmbeddingService {
            constructor(_baseUrl: string, _model: string, _dimension: number) {
                // 构造函数不需要实际逻辑
            }

            async embed(text: string): Promise<Float32Array> {
                // 为了向后兼容，保留 embed 方法，但内部调用 embedBatch
                return (await this.embedBatch([text]))[0];
            }

            async embedBatch(texts: string[]): Promise<Float32Array[]> {
                embedBatchCallCount++;
                embedBatchTextCount += texts.length;
                return texts.map(text => generateMockVector(text));
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
        embedBatchCallCount = 0; // 重置计数器
        embedBatchTextCount = 0; // 重置文本计数
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

    it("should call embedBatch method for unique texts", async () => {
        const interests = [{ keyword: "人工智能", liked: true }];
        const topic = "大模型与人工智能发展";

        await rater.scoreTopic(interests, topic);

        // 应该调用 embedBatch 一次，包含 topic 和 keyword（带前缀）共 2 个文本
        expect(embedBatchCallCount).toBeGreaterThanOrEqual(1);
        expect(embedBatchTextCount).toBeGreaterThanOrEqual(2);
    });

    it("should use cache for repeated texts", async () => {
        const interests = [{ keyword: "人工智能", liked: true }];
        const topic = "大模型与人工智能发展";

        embedBatchTextCount = 0; // 重置计数
        await rater.scoreTopic(interests, topic);
        const firstCallTextCount = embedBatchTextCount;

        embedBatchTextCount = 0; // 重置计数
        await rater.scoreTopic(interests, topic);

        // 由于缓存，第二次调用时不应该再请求 embedding
        expect(embedBatchTextCount).toBe(0);
        // 第一次调用应该请求了 topic 和 keyword 的 embedding
        expect(firstCallTextCount).toBeGreaterThanOrEqual(2);
    });

    it("should clear cache when clearCache is called", async () => {
        const interests = [{ keyword: "人工智能", liked: true }];
        const topic = "大模型与人工智能发展";

        embedBatchTextCount = 0; // 重置计数
        await rater.scoreTopic(interests, topic);
        const firstCallTextCount = embedBatchTextCount;

        rater.clearCache();

        embedBatchTextCount = 0; // 重置计数
        await rater.scoreTopic(interests, topic);
        const secondCallTextCount = embedBatchTextCount;

        // 清理缓存后，应该再次请求 embedding
        expect(secondCallTextCount).toBeGreaterThanOrEqual(2);
        expect(firstCallTextCount).toBeGreaterThanOrEqual(2);
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
