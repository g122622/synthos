// tests/VectorDBManager.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { VectorDBManager } from "../embedding/VectorDBManager";
import { join } from "path";
import { rm, mkdtemp } from "fs/promises";
import { tmpdir } from "os";

// Mock Logger
vi.mock("@root/common/util/Logger", () => {
    return {
        default: {
            withTag: () => ({
                debug: console.log,
                info: console.log,
                success: console.log,
                warning: console.warn,
                error: console.error
            })
        }
    };
});

describe("VectorDBManager", () => {
    let manager: VectorDBManager;
    let tempDir: string;
    let dbPath: string;

    const TEST_DIMENSION = 128; // 使用较小的维度加速测试

    // 生成随机向量
    const generateRandomVector = (dimension: number): Float32Array => {
        const arr = new Float32Array(dimension);
        for (let i = 0; i < dimension; i++) {
            arr[i] = Math.random();
        }
        return arr;
    };

    beforeEach(async () => {
        // 创建临时目录
        tempDir = await mkdtemp(join(tmpdir(), "vectordb-test-"));
        dbPath = join(tempDir, "test-vectors.db");

        manager = new VectorDBManager(dbPath, TEST_DIMENSION);
        await manager.init();
    });

    afterEach(async () => {
        // 释放资源并删除临时目录
        await manager.dispose();
        try {
            await rm(tempDir, { recursive: true, force: true });
        } catch {
            // 忽略删除失败
        }
    });

    describe("init", () => {
        it("should initialize database and create tables", async () => {
            // 如果 init 成功，getCount 应该返回 0
            const count = manager.getCount();
            expect(count).toBe(0);
        });
    });

    describe("storeEmbedding", () => {
        it("should store a single embedding", () => {
            const topicId = "topic-001";
            const embedding = generateRandomVector(TEST_DIMENSION);

            manager.storeEmbedding(topicId, embedding);

            expect(manager.hasEmbedding(topicId)).toBe(true);
            expect(manager.getCount()).toBe(1);
        });

        it("should throw error for wrong dimension", () => {
            const topicId = "topic-002";
            const wrongEmbedding = generateRandomVector(64); // 错误维度

            expect(() => manager.storeEmbedding(topicId, wrongEmbedding)).toThrow(
                `向量维度不匹配：期望 ${TEST_DIMENSION}，实际 64`
            );
        });

        it("should replace embedding for same topicId", () => {
            const topicId = "topic-003";
            const embedding1 = generateRandomVector(TEST_DIMENSION);
            const embedding2 = generateRandomVector(TEST_DIMENSION);

            manager.storeEmbedding(topicId, embedding1);
            manager.storeEmbedding(topicId, embedding2);

            // 由于 INSERT OR REPLACE，映射表只有一条记录
            // 但 vec_topics 会有两条记录（旧的成为孤儿记录）
            expect(manager.hasEmbedding(topicId)).toBe(true);
        });
    });

    describe("storeEmbeddings", () => {
        it("should store multiple embeddings in batch", () => {
            const items = [
                { topicId: "batch-001", embedding: generateRandomVector(TEST_DIMENSION) },
                { topicId: "batch-002", embedding: generateRandomVector(TEST_DIMENSION) },
                { topicId: "batch-003", embedding: generateRandomVector(TEST_DIMENSION) }
            ];

            manager.storeEmbeddings(items);

            expect(manager.getCount()).toBe(3);
            expect(manager.hasEmbedding("batch-001")).toBe(true);
            expect(manager.hasEmbedding("batch-002")).toBe(true);
            expect(manager.hasEmbedding("batch-003")).toBe(true);
        });

        it("should do nothing for empty array", () => {
            manager.storeEmbeddings([]);
            expect(manager.getCount()).toBe(0);
        });

        it("should throw error if any embedding has wrong dimension", () => {
            const items = [
                { topicId: "batch-004", embedding: generateRandomVector(TEST_DIMENSION) },
                { topicId: "batch-005", embedding: generateRandomVector(64) } // 错误维度
            ];

            expect(() => manager.storeEmbeddings(items)).toThrow(/向量维度不匹配/);
        });
    });

    describe("hasEmbedding", () => {
        it("should return true for existing topicId", () => {
            const topicId = "exists-001";
            manager.storeEmbedding(topicId, generateRandomVector(TEST_DIMENSION));

            expect(manager.hasEmbedding(topicId)).toBe(true);
        });

        it("should return false for non-existing topicId", () => {
            expect(manager.hasEmbedding("non-existent")).toBe(false);
        });
    });

    describe("filterWithoutEmbedding", () => {
        it("should return empty array for empty input", () => {
            const result = manager.filterWithoutEmbedding([]);
            expect(result).toEqual([]);
        });

        it("should return all topicIds if none have embeddings", () => {
            const topicIds = ["new-001", "new-002", "new-003"];
            const result = manager.filterWithoutEmbedding(topicIds);

            expect(result).toEqual(topicIds);
        });

        it("should filter out topicIds that already have embeddings", () => {
            // 存储部分 topicId 的向量
            manager.storeEmbedding("existing-001", generateRandomVector(TEST_DIMENSION));
            manager.storeEmbedding("existing-002", generateRandomVector(TEST_DIMENSION));

            const topicIds = ["existing-001", "new-001", "existing-002", "new-002"];
            const result = manager.filterWithoutEmbedding(topicIds);

            expect(result).toEqual(["new-001", "new-002"]);
        });

        it("should return empty array if all have embeddings", () => {
            manager.storeEmbedding("all-001", generateRandomVector(TEST_DIMENSION));
            manager.storeEmbedding("all-002", generateRandomVector(TEST_DIMENSION));

            const result = manager.filterWithoutEmbedding(["all-001", "all-002"]);

            expect(result).toEqual([]);
        });
    });

    describe("getCount", () => {
        it("should return 0 for empty database", () => {
            expect(manager.getCount()).toBe(0);
        });

        it("should return correct count after insertions", () => {
            manager.storeEmbedding("count-001", generateRandomVector(TEST_DIMENSION));
            expect(manager.getCount()).toBe(1);

            manager.storeEmbedding("count-002", generateRandomVector(TEST_DIMENSION));
            expect(manager.getCount()).toBe(2);

            manager.storeEmbedding("count-003", generateRandomVector(TEST_DIMENSION));
            expect(manager.getCount()).toBe(3);
        });
    });

    describe("searchSimilar", () => {
        it("should throw error for wrong query dimension", () => {
            const wrongQuery = generateRandomVector(64);

            expect(() => manager.searchSimilar(wrongQuery, [], 5)).toThrow(
                `查询向量维度不匹配：期望 ${TEST_DIMENSION}，实际 64`
            );
        });

        it("should return empty array when database is empty", () => {
            const query = generateRandomVector(TEST_DIMENSION);
            const result = manager.searchSimilar(query, [], 5);

            expect(result).toEqual([]);
        });

        it("should return results ordered by distance", () => {
            // 创建一个基准向量
            const baseVector = new Float32Array(TEST_DIMENSION).fill(1.0);

            // 创建相似度不同的向量
            const similarVector = new Float32Array(TEST_DIMENSION).fill(0.9);
            const lessSimilarVector = new Float32Array(TEST_DIMENSION).fill(0.5);
            const dissimilarVector = new Float32Array(TEST_DIMENSION).fill(0.1);

            manager.storeEmbedding("similar", similarVector);
            manager.storeEmbedding("less-similar", lessSimilarVector);
            manager.storeEmbedding("dissimilar", dissimilarVector);

            const result = manager.searchSimilar(baseVector, [], 3);

            expect(result.length).toBe(3);
            // 结果应该按距离升序排列（距离越小越相似）
            expect(result[0].distance).toBeLessThanOrEqual(result[1].distance);
            expect(result[1].distance).toBeLessThanOrEqual(result[2].distance);
        });

        it("should respect limit parameter", () => {
            for (let i = 0; i < 10; i++) {
                manager.storeEmbedding(`limit-${i}`, generateRandomVector(TEST_DIMENSION));
            }

            const query = generateRandomVector(TEST_DIMENSION);
            const result = manager.searchSimilar(query, [], 3);

            expect(result.length).toBe(3);
        });

        it("should filter by candidate topicIds", () => {
            manager.storeEmbedding("candidate-001", generateRandomVector(TEST_DIMENSION));
            manager.storeEmbedding("candidate-002", generateRandomVector(TEST_DIMENSION));
            manager.storeEmbedding("non-candidate", generateRandomVector(TEST_DIMENSION));

            const query = generateRandomVector(TEST_DIMENSION);
            const result = manager.searchSimilar(query, ["candidate-001", "candidate-002"], 10);

            expect(result.length).toBe(2);
            const topicIds = result.map(r => r.topicId);
            expect(topicIds).toContain("candidate-001");
            expect(topicIds).toContain("candidate-002");
            expect(topicIds).not.toContain("non-candidate");
        });
    });
});
