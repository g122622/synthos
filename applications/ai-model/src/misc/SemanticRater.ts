import Logger from "@root/common/util/Logger";
import { OllamaEmbeddingService } from "../services/embedding/OllamaEmbeddingService";
import { UserInterest } from "@root/common/services/config/schemas/GlobalConfig";
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
     * 批量获取文本的 embedding
     * @param items 文本项数组，每个包含 text 和 isKeywordQuery 标志
     * @returns embedding 数组
     */
    private async getEmbeddingBatch(
        items: Array<{ text: string; isKeywordQuery: boolean }>
    ): Promise<Float32Array[]> {
        if (items.length === 0) {
            return [];
        }

        // 预处理：生成 inputText，处理长度限制，并检查缓存
        const processedItems: Array<{
            originalIndex: number;
            inputText: string;
            cachedVector?: Float32Array;
        }> = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            let inputText = item.isKeywordQuery
                ? EmbeddingPromptStore.getEmbeddingPromptForInterestScore(item.text)
                : item.text;

            if (inputText.length > MAX_INPUT_LENGTH) {
                this.LOGGER.warning(`输入文本过长 (长度为 ${inputText.length})，截断至 ${MAX_INPUT_LENGTH} 字符`);
                this.LOGGER.warning(`原始文本：${inputText}`);
                inputText = inputText.slice(0, MAX_INPUT_LENGTH);
            }

            // 检查缓存
            if (this.vectorCache.has(inputText)) {
                processedItems.push({
                    originalIndex: i,
                    inputText,
                    cachedVector: this.vectorCache.get(inputText)!
                });
            } else {
                processedItems.push({
                    originalIndex: i,
                    inputText
                });
            }
        }

        // 分离需要批量请求的文本和已缓存的向量
        const textsToFetch: string[] = [];
        const indicesToFetch: number[] = [];

        for (let i = 0; i < processedItems.length; i++) {
            if (!processedItems[i].cachedVector) {
                textsToFetch.push(processedItems[i].inputText);
                indicesToFetch.push(i);
            }
        }

        // 批量获取未缓存的 embedding
        let fetchedVectors: Float32Array[] = [];
        if (textsToFetch.length > 0) {
            fetchedVectors = await this.embeddingService.embedBatch(textsToFetch);
            // 将新获取的向量存入缓存
            for (let i = 0; i < textsToFetch.length; i++) {
                this.vectorCache.set(textsToFetch[i], fetchedVectors[i]);
            }
        }

        // 组装结果：按照原始顺序返回
        const result: Float32Array[] = [];
        let fetchedIndex = 0;

        for (let i = 0; i < processedItems.length; i++) {
            const item = processedItems[i];
            if (item.cachedVector) {
                result[item.originalIndex] = item.cachedVector;
            } else {
                result[item.originalIndex] = fetchedVectors[fetchedIndex];
                fetchedIndex++;
            }
        }

        return result;
    }

    /**
     * 获取文本的 embedding
     * @param text 文本
     * @param isKeywordQuery 是否关键词查询
     * @returns embedding
     */
    private async getEmbedding(text: string, isKeywordQuery: boolean): Promise<Float32Array> {
        const vectors = await this.getEmbeddingBatch([{ text, isKeywordQuery }]);
        return vectors[0];
    }

    public clearCache(): void {
        this.vectorCache.clear();
    }

    /**
     * 对多个话题进行批量打分
     * @param userInterests 用户兴趣关键词列表，每个包含 keyword 和 liked 标志
     * @param topics 话题详情文本数组
     * @returns 打分值数组，范围 [-1, 1]
     *   - 正向关键词（liked: true）：取与话题的最大相似度
     *   - 负向关键词（liked: false）：取与话题的最大相似度
     *   - 最终得分 = max_sim(正向) - max_sim(负向)
     */
    public async scoreTopics(userInterests: UserInterest[], topics: string[]): Promise<number[]> {
        if (userInterests.length === 0) {
            throw new Error("User interests cannot be empty");
        }

        if (topics.length === 0) {
            return [];
        }

        const positiveKeywords = userInterests.filter(item => item.liked).map(item => item.keyword);
        const negativeKeywords = userInterests.filter(item => !item.liked).map(item => item.keyword);

        // 收集所有需要获取 embedding 的文本
        const embeddingItems: Array<{ text: string; isKeywordQuery: boolean }> = [];

        // 添加所有 topics（isKeywordQuery=false）
        for (const topic of topics) {
            embeddingItems.push({ text: topic, isKeywordQuery: false });
        }

        // 添加所有正向关键词（isKeywordQuery=true，去重）
        const uniquePositiveKeywords = Array.from(new Set(positiveKeywords));
        for (const keyword of uniquePositiveKeywords) {
            embeddingItems.push({ text: keyword, isKeywordQuery: true });
        }

        // 添加所有负向关键词（isKeywordQuery=true，去重）
        const uniqueNegativeKeywords = Array.from(new Set(negativeKeywords));
        for (const keyword of uniqueNegativeKeywords) {
            embeddingItems.push({ text: keyword, isKeywordQuery: true });
        }

        // 批量获取所有 embedding
        const allVectors = await this.getEmbeddingBatch(embeddingItems);

        // 建立索引映射
        let index = 0;
        const topicVectors: Float32Array[] = [];
        for (let i = 0; i < topics.length; i++) {
            topicVectors.push(allVectors[index]);
            index++;
        }

        const positiveKeywordVectors = new Map<string, Float32Array>();
        for (const keyword of uniquePositiveKeywords) {
            positiveKeywordVectors.set(keyword, allVectors[index]);
            index++;
        }

        const negativeKeywordVectors = new Map<string, Float32Array>();
        for (const keyword of uniqueNegativeKeywords) {
            negativeKeywordVectors.set(keyword, allVectors[index]);
            index++;
        }

        // 对每个 topic 计算得分
        const scores: number[] = [];
        for (let i = 0; i < topics.length; i++) {
            const topicVec = topicVectors[i];

            let posSim = 0;
            let negSim = 0;

            // 正向：取最大相似度（若无正向关键词，则为 0）
            if (positiveKeywords.length > 0) {
                const posSims = positiveKeywords.map(keyword => {
                    const vec = positiveKeywordVectors.get(keyword)!;
                    return this.cosineSimilarity(vec, topicVec);
                });
                posSim = Math.max(...posSims);
            }

            // 负向：取最大相似度（若无负向关键词，则为 0）
            if (negativeKeywords.length > 0) {
                const negSims = negativeKeywords.map(keyword => {
                    const vec = negativeKeywordVectors.get(keyword)!;
                    return this.cosineSimilarity(vec, topicVec);
                });
                negSim = Math.max(...negSims);
            }

            let score = posSim - negSim; // 理论范围 [-1, 1]

            // 防御性 clamp（虽然理论上不会越界，但确保鲁棒性）
            scores.push(Math.max(-1, Math.min(1, score)));
        }

        return scores;
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
        const scores = await this.scoreTopics(userInterests, [topicDetail]);
        return scores[0];
    }

    private cosineSimilarity(a: Float32Array, b: Float32Array): number {
        let dot = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
        }
        return dot; // 已 L2 归一化，点积 = 余弦相似度
    }
}
