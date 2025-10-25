import Logger from "@root/common/util/Logger";
import { pipeline, env } from "@huggingface/transformers";
import type { DataArray } from "@huggingface/transformers";
import { UserInterest } from "@root/common/config/@types/GlobalConfig";

env.allowLocalModels = true;

const QUERY_PREFIX = "为这个句子生成表示：";
const MODEL_ID = "Xenova/bge-large-zh-v1.5";

export class SemanticRater {
    private embedder: any = null;
    private modelLoadPromise: Promise<void> | null = null;
    private vectorCache = new Map<string, DataArray>();
    private LOGGER = Logger.withTag("SemanticRater");

    private async ensureModelLoaded(): Promise<void> {
        if (this.embedder) return;
        if (this.modelLoadPromise) return this.modelLoadPromise;

        this.modelLoadPromise = (async () => {
            this.LOGGER.info("Loading BGE model...");
            this.embedder = await pipeline("feature-extraction", MODEL_ID);
            this.LOGGER.info("Model loaded.");
        })();

        await this.modelLoadPromise;
    }

    private async getEmbedding(text: string, isQuery = false): Promise<DataArray> {
        await this.ensureModelLoaded();
        const inputText = isQuery ? `${QUERY_PREFIX}${text}` : text;

        if (this.vectorCache.has(inputText)) {
            return this.vectorCache.get(inputText)!;
        }

        const output = await this.embedder(inputText, {
            pooling: "cls",
            normalize: true
        });

        const vector = output.data as DataArray;
        this.vectorCache.set(inputText, vector);
        return vector;
    }

    public clearCache(): void {
        this.vectorCache.clear();
    }

    /**
     * 对单个话题进行打分
     * @param userInterests 用户兴趣关键词列表，每个包含 keyword 和 liked 标志
     * @param topicDetail 话题详情文本
     * @returns 打分值，范围 [-1, 1]
     *   - 正向关键词（liked: true）：取与话题的最大相似度
     *   - 负向关键词（liked: false）：取与话题的最大相似度
     *   - 最终得分 = max_sim(正向) - max_sim(负向)
     */
    public async scoreTopic(userInterests: UserInterest[], topicDetail: string): Promise<number> {
        if (userInterests.length === 0) {
            throw new Error("User interests cannot be empty");
        }

        const topicVec = await this.getEmbedding(topicDetail, false);

        const positiveKeywords = userInterests.filter(item => item.liked).map(item => item.keyword);
        const negativeKeywords = userInterests
            .filter(item => !item.liked)
            .map(item => item.keyword);

        let posSim = 0;
        let negSim = 0;

        // 正向：取最大相似度（若无正向关键词，则为 0）
        if (positiveKeywords.length > 0) {
            const posSims = await Promise.all(
                positiveKeywords.map(async keyword => {
                    const vec = await this.getEmbedding(keyword, true);
                    return this.cosineSimilarity(vec, topicVec);
                })
            );
            posSim = Math.max(...posSims);
        }

        // 负向：取最大相似度（若无负向关键词，则为 0）
        if (negativeKeywords.length > 0) {
            const negSims = await Promise.all(
                negativeKeywords.map(async keyword => {
                    const vec = await this.getEmbedding(keyword, true);
                    return this.cosineSimilarity(vec, topicVec);
                })
            );
            negSim = Math.max(...negSims);
        }

        let score = posSim - negSim; // 理论范围 [-1, 1]

        // 防御性 clamp（虽然理论上不会越界，但确保鲁棒性）
        return Math.max(-1, Math.min(1, score));
    }

    public async scoreTopics(userInterests: UserInterest[], topics: string[]): Promise<number[]> {
        const scores = await Promise.all(
            topics.map(topic => this.scoreTopic(userInterests, topic))
        );
        return scores;
    }

    private cosineSimilarity(a: DataArray, b: DataArray): number {
        let dot = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
        }
        return dot; // 已 L2 归一化，点积 = 余弦相似度
    }
}
