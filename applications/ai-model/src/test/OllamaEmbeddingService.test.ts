// tests/EmbeddingService.test.ts
import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { EmbeddingService } from "../services/embedding/EmbeddingService";
import axios from "axios";

// Mock axios
vi.mock("axios", () => {
    const mockAxiosInstance = {
        post: vi.fn(),
        get: vi.fn()
    };
    return {
        default: {
            create: vi.fn(() => mockAxiosInstance),
            isAxiosError: vi.fn((error: any) => error.isAxiosError === true)
        }
    };
});

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

describe("EmbeddingService", () => {
    let service: EmbeddingService;
    let mockAxiosInstance: { post: Mock; get: Mock };

    const TEST_BASE_URL = "http://localhost:11434";
    const TEST_MODEL = "bge-m3";
    const TEST_DIMENSION = 1024;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new EmbeddingService(TEST_BASE_URL, TEST_MODEL, TEST_DIMENSION);
        // 获取 mock 的 axios 实例
        mockAxiosInstance = (axios.create as Mock).mock.results[0].value;
    });

    describe("constructor", () => {
        it("should create axios instance with correct config", () => {
            expect(axios.create).toHaveBeenCalledWith({
                baseURL: TEST_BASE_URL,
                timeout: 600000, // 600s
                headers: {
                    "Content-Type": "application/json"
                }
            });
        });
    });

    describe("embed", () => {
        it("should return Float32Array for single text", async () => {
            const mockEmbedding = Array(TEST_DIMENSION).fill(0.1);
            mockAxiosInstance.post.mockResolvedValueOnce({
                data: {
                    model: TEST_MODEL,
                    embeddings: [mockEmbedding]
                }
            });

            const result = await service.embed("测试文本");

            expect(result).toBeInstanceOf(Float32Array);
            expect(result.length).toBe(TEST_DIMENSION);
            expect(mockAxiosInstance.post).toHaveBeenCalledWith("/api/embed", {
                model: TEST_MODEL,
                input: ["测试文本"]
            });
        });
    });

    describe("embedBatch", () => {
        it("should return empty array for empty input", async () => {
            const result = await service.embedBatch([]);

            expect(result).toEqual([]);
            expect(mockAxiosInstance.post).not.toHaveBeenCalled();
        });

        it("should return Float32Array[] for multiple texts", async () => {
            const mockEmbeddings = [
                Array(TEST_DIMENSION).fill(0.1),
                Array(TEST_DIMENSION).fill(0.2),
                Array(TEST_DIMENSION).fill(0.3)
            ];
            mockAxiosInstance.post.mockResolvedValueOnce({
                data: {
                    model: TEST_MODEL,
                    embeddings: mockEmbeddings
                }
            });

            const texts = ["文本1", "文本2", "文本3"];
            const result = await service.embedBatch(texts);

            expect(result.length).toBe(3);
            expect(result[0]).toBeInstanceOf(Float32Array);
            expect(result[1]).toBeInstanceOf(Float32Array);
            expect(result[2]).toBeInstanceOf(Float32Array);
            expect(mockAxiosInstance.post).toHaveBeenCalledWith("/api/embed", {
                model: TEST_MODEL,
                input: texts
            });
        });

        it("should throw error if dimension mismatch", async () => {
            const wrongDimensionEmbedding = Array(512).fill(0.1); // 错误的维度
            mockAxiosInstance.post.mockResolvedValueOnce({
                data: {
                    model: TEST_MODEL,
                    embeddings: [wrongDimensionEmbedding]
                }
            });

            await expect(service.embedBatch(["测试"])).rejects.toThrow(
                `向量维度不匹配：期望 ${TEST_DIMENSION}，实际 512`
            );
        });

        it("should throw error on API failure", async () => {
            const axiosError = new Error("Network Error");
            (axiosError as any).isAxiosError = true;
            (axiosError as any).code = "ECONNREFUSED";
            mockAxiosInstance.post.mockRejectedValueOnce(axiosError);

            await expect(service.embedBatch(["测试"])).rejects.toThrow("Network Error");
        });

        it("should handle non-axios errors", async () => {
            const genericError = new Error("Unknown error");
            mockAxiosInstance.post.mockRejectedValueOnce(genericError);

            await expect(service.embedBatch(["测试"])).rejects.toThrow("Unknown error");
        });
    });

    describe("isAvailable", () => {
        it("should return true when Ollama service is available", async () => {
            mockAxiosInstance.get.mockResolvedValueOnce({ data: { models: [] } });

            const result = await service.isAvailable();

            expect(result).toBe(true);
            expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/tags");
        });

        it("should return false when Ollama service is not available", async () => {
            mockAxiosInstance.get.mockRejectedValueOnce(new Error("Connection refused"));

            const result = await service.isAvailable();

            expect(result).toBe(false);
        });
    });
});
