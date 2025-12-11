/**
 * RAG Prompt Store
 * 存储 RAG 问答相关的 prompt 模板
 */
export class RagPromptStore {
    /**
     * 获取 RAG 问答的 prompt 模板
     * @param question 用户问题
     * @param topics 相关话题内容
     * @returns 完整的 prompt
     */
    public static getRagPrompt(question: string, topics: string): string {
        return `你是一个智能助手，请根据以下检索到的话题内容回答用户的问题。
                【用户问题】
                ${question}

                【相关话题】
                ${topics}

                【回答要求】
                1. 基于上述话题内容回答问题
                2. 如果引用了某个话题的内容，请标注来源，格式为 [话题: xxx]
                3. 如果话题内容无法回答问题，请如实告知
                4. 回答要简洁明了，不要重复话题原文

                请回答：`;
    }
}
