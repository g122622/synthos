/**
 * RAG Prompt Store
 * 存储 RAG 问答相关的 prompt 模板
 */
export class RagPromptStore {
    /**
     * 获取 RAG 问答的 prompt 模板
     * @param question 用户问题
     * @param topics 相关话题内容
     * @param currentDate 当前日期（可选）
     * @returns 完整的 prompt
     */
    public static getRagPrompt(
        question: string, 
        topics: string, 
        currentDate?: string
    ): string {
        let prompt = `你是一个智能助手，请根据以下检索到的话题内容回答用户问题。`;
        
        // 添加当前日期信息
        if (currentDate) {
            prompt += `\n\n【当前日期时间】\n${currentDate}`;
        }
        
        prompt += `\n\n【相关话题】\n${topics}`;
        
        prompt += `\n【用户问题】\n${question}\n\n【回答要求】
1. 遵从上述话题内容回答问题，考虑话题发生的时间背景
2. 如果引用了某个话题的内容，请在句子末尾标注来源，格式类似：[话题7] [话题11] [话题23]
3. 如果话题内容无法回答问题，请如实告知
4. 回答要系统、完备、结构清晰，尽量不遗漏信息
5. 请注意话题发生的时间，考虑时效性对回答的影响

请回答：`;
        
        return prompt;
    }
}
