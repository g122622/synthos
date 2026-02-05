/**
 * EmbeddingService
 * 封装 Ollama 的 /api/embed 接口，提供文本嵌入向量生成能力
 */
import "reflect-metadata";
import axios, { AxiosInstance } from "axios";
import Logger from "@root/common/util/Logger";
import { injectable } from "tsyringe";

interface OllamaEmbedResponse {
    model: string;
    embeddings: number[][];
}

@injectable()
export class EmbeddingService {
    private client: AxiosInstance;
    private model: string;
    private dimension: number;
    private LOGGER = Logger.withTag("EmbeddingService");

    /**
     * @param baseURL Ollama 服务地址，如 "http://localhost:11434"
     * @param model 嵌入模型名，如 "bge-m3"
     * @param dimension 向量维度，bge-m3 为 1024
     */
    constructor(baseURL: string, model: string, dimension: number) {
        this.client = axios.create({
            baseURL,
            timeout: 10 * 60 * 1000, // 10min超时
            headers: {
                "Content-Type": "application/json"
            }
        });
        this.model = model;
        this.dimension = dimension;
        this.LOGGER.info(`初始化完成，模型: ${model}，维度: ${dimension}`);
    }

    /**
     * 生成单个文本的嵌入向量
     * @param text 输入文本
     * @returns Float32Array (指定维度)
     */
    async embed(text: string): Promise<Float32Array> {
        const embeddings = await this.embedBatch([text]);

        return embeddings[0];
    }

    /**
     * 批量生成嵌入向量
     * @param texts 输入文本数组
     * @returns Float32Array[] 向量数组
     */
    async embedBatch(texts: string[]): Promise<Float32Array[]> {
        if (texts.length === 0) {
            return [];
        }

        try {
            const response = await this.client.post<OllamaEmbedResponse>("/api/embed", {
                model: this.model,
                input: texts
            });

            const embeddings = response.data.embeddings;

            // 校验向量维度
            for (let i = 0; i < embeddings.length; i++) {
                if (embeddings[i].length !== this.dimension) {
                    throw new Error(`向量维度不匹配：期望 ${this.dimension}，实际 ${embeddings[i].length}`);
                }
            }

            // 转换为 Float32Array
            return embeddings.map(embedding => new Float32Array(embedding));
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.code === "ECONNREFUSED") {
                    this.LOGGER.error(`Ollama 服务不可用，请确保 Ollama 正在运行`);
                } else {
                    this.LOGGER.error(
                        `Ollama API 请求失败: ${error.message}。如果出现请求超时报错，可以尝试延长超时时间`
                    );
                }
            } else {
                this.LOGGER.error(`生成嵌入向量失败: ${error}`);
            }
            throw error;
        }
    }

    /**
     * 检查 Ollama 服务是否可用
     * @returns boolean
     */
    async isAvailable(): Promise<boolean> {
        try {
            await this.client.get("/api/tags");

            return true;
        } catch {
            return false;
        }
    }
}
