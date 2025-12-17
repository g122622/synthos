/**
 * RAG Prompt Store
 * 存储 RAG 问答相关的 prompt 模板
 */
export class RagPromptStore {
    public static getMultiQueryPrompt(userQuestion: string) {
        return `
            你是一个查询扩展助手。请将以下用户问题改写为3个不同角度的查询，以便更好地从向量数据库中检索相关内容。

            【用户问题】${userQuestion}

            【要求】
            1. 保持原意，但从不同角度表述
            2. 使用同义词、近义词并拓展相关概念
            3. 请严格按照下面标准JSON数组格式输出，数组中每个元素为一个查询字符串，且你的输出不要在JSON外添加任何文字说明

            【输入示例】
            评价一下AI领域的各个研究方向？

            【输出示例】
            [
                "AI领域有哪些主要科研方向，各自的研究内容、优缺点和发展前景如何？",
                "如何评估当前人工智能不同研究分支（如机器学习、自然语言处理、计算机视觉等）的进展与价值？",
                "从学术、产业应用、薪酬待遇、个人发展角度，对人工智能各子领域的研究方向进行综合评述。
            ]

            请输出3个改写后的查询：
        `
    }

    /**
     * 获取 RAG 问答的 prompt 模板
     * @param userQuestion 用户问题
     * @param topics 相关话题内容
     * @param currentDate 当前日期（可选）
     * @returns 完整的 prompt
     */
    public static getRagAnswerPrompt(
        userQuestion: string, 
        topics: string, 
        currentDate?: string
    ): string {
        let prompt = `你是一个智能助手，请根据以下检索到的话题内容回答用户问题。`;
        
        // 添加当前日期信息
        if (currentDate) {
            prompt += `\n\n【当前日期时间】\n${currentDate}`;
        }
        
        prompt += `\n\n【相关话题】\n${topics}`;
        
        prompt += `\n【用户问题】\n${userQuestion}\n\n【回答要求】
            1. 遵从上述话题内容回答问题，考虑话题发生的时间背景
            2. 如果引用了某个话题的内容，请在句子末尾标注来源，格式类似：[话题7] [话题11] [话题23]
            3. 如果话题内容无法回答问题，请如实告知
            4. 回答要系统、完备、结构清晰，尽量不遗漏信息
            5. 请注意话题发生的时间，考虑时效性对回答的影响

            请回答：`;
        
        return prompt;
    }
}
