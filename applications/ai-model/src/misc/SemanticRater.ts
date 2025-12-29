import Logger from "@root/common/util/Logger";
import { OllamaEmbeddingService } from "../embedding/OllamaEmbeddingService";
import { UserInterest } from "@root/common/config/@types/GlobalConfig";
import { EmbeddingPromptStore } from "../context/prompts/EmbeddingPromptStore";
const MAX_INPUT_LENGTH = Infinity; // 保留此配置项，以备后续可能需要限制输入长度

export class SemanticRater {
    private embeddingService: OllamaEmbeddingService;
    private vectorCache = new Map<string, Float32Array>();
    private LOGGER = Logger.withTag("SemanticRater");

    /**
     * 构造函数
     * @param embeddingService OllamaEmbeddingService 实例
     */
    constructor(embeddingService: OllamaEmbeddingService) {
        this.embeddingService = embeddingService;
        this.LOGGER.info("SemanticRater 初始化完成");
    }

    /**
     * 获取文本的 embedding
     * @param text 文本
     * @param isKeywordQuery 是否关键词查询
     * @returns embedding
     */
    private async getEmbedding(text: string, isKeywordQuery: boolean): Promise<Float32Array> {
        let inputText = isKeywordQuery ? EmbeddingPromptStore.getEmbeddingPromptForInterestScore(text) : text;

        if (inputText.length > MAX_INPUT_LENGTH) {
            this.LOGGER.warning(`输入文本过长 (长度为 ${inputText.length})，截断至 ${MAX_INPUT_LENGTH} 字符`);
            this.LOGGER.warning(`原始文本：${inputText}`);
            inputText = inputText.slice(0, MAX_INPUT_LENGTH);
        }

        if (this.vectorCache.has(inputText)) {
            return this.vectorCache.get(inputText)!;
        }

        const vector = await this.embeddingService.embed(inputText);
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

    private cosineSimilarity(a: Float32Array, b: Float32Array): number {
        let dot = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
        }
        return dot; // 已 L2 归一化，点积 = 余弦相似度
    }
}
