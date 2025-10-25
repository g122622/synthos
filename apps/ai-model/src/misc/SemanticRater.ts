import Logger from "@root/common/util/Logger";
import { pipeline, env } from "@huggingface/transformers";
import type { DataArray } from "@huggingface/transformers";

env.allowLocalModels = true;

const QUERY_PREFIX = "为这个句子生成表示：";
const MODEL_ID = "Xenova/bge-large-zh-v1.5";

export interface UserInterest {
    keyword: string;
    liked: boolean;
}

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
     *   - 正向关键词（liked: true）提升分数
     *   - 负向关键词（liked: false）降低分数
     *   - 最终得分 = avg_sim(正向) - avg_sim(负向)
     */
    public async scoreTopic(userInterests: UserInterest[], topicDetail: string): Promise<number> {
        // ### ✅ 设计思路
        // 我们将用户兴趣拆分为两部分：
        // - **正向查询（liked: true）** → 用 BGE 查询前缀编码，**加权聚合**
        // - **负向查询（liked: false）** → 同样编码，但最终**从总分中减去其相似度**
        // 最终得分公式（归一化到 [-1, 1]）：
        // ```ts
        // score = sim_pos - sim_neg
        // // 然后 clamp 到 [-1, 1]
        // ```
        // > 💡 举例：
        // >
        // > - 正词：“北邮” → 与话题相似度 0.8
        // > - 负词：“科软” → 与话题相似度 0.6
        // > - 最终得分 = 0.8 - 0.6 = **0.2**

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

        if (positiveKeywords.length > 0) {
            // TODO 目前是把用户提供的所有关键词都拼在一起，然后与topic比较余弦相似度。
            // 未来可以考虑：
            // 1. 每个关键词独立计算，然后求和。
            // 2. 与正文内容而不是topic比较相似度，这样也许更准？
            const posQuery = positiveKeywords.join("，");
            const posVec = await this.getEmbedding(posQuery, true);
            posSim = this.cosineSimilarity(posVec, topicVec);
        }

        if (negativeKeywords.length > 0) {
            const negQuery = negativeKeywords.join("，");
            const negVec = await this.getEmbedding(negQuery, true);
            negSim = this.cosineSimilarity(negVec, topicVec);
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
