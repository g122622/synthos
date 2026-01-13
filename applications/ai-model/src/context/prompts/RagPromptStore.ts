import { ContentUtils } from "../template/ContentUtils";
import { CtxTemplateNode } from "../template/CtxTemplate";

/**
 * RAG Prompt Store
 * 存储 RAG 问答相关的 prompt 模板
 */
export class RagPromptStore {
    /**
     * Get multi-query expansion prompt
     * @param userQuestion User's question to be expanded
     */
    public static getMultiQueryPrompt(userQuestion: string): CtxTemplateNode {
        const root = new CtxTemplateNode();

        root.setChildNodes([
            new CtxTemplateNode()
                .setTitle("你的角色")
                .setContentText(
                    "你是一个查询扩展助手。请将以下用户问题改写为3个不同角度的查询，以便更好地从向量数据库中检索相关内容。"
                ),
            new CtxTemplateNode().setTitle("用户问题").setContentText(userQuestion),
            new CtxTemplateNode()
                .setTitle("要求")
                .setContentText(
                    ContentUtils.orderedList([
                        "在不改变原始含义的基础上，从其他视角或立场进行重新表述",
                        "采用同义词、近义词，并适当延伸与之相关的概念或语境",
                        "严格按照下面标准 JSON 数组格式输出，数组中的每个元素必须是一个独立的查询字符串，且你的输出内容不得包含 JSON 结构之外的任何文字说明"
                    ])
                ),
            new CtxTemplateNode().setTitle("输入示例").setContentText("评价一下AI领域的各个研究方向？"),
            new CtxTemplateNode().setTitle("输出示例").setContentText(`
            [
                "AI领域有哪些主要科研方向，各自的研究内容、优缺点和发展前景如何？",
                "如何评估当前人工智能不同研究分支（如机器学习、自然语言处理、计算机视觉等）的进展与价值？",
                "从学术、产业应用、薪酬待遇、个人发展角度，对人工智能各子领域的研究方向进行综合评述。"
            ]`),
            new CtxTemplateNode().setTitle("你的任务").setContentText("请输出3个改写后的查询：")
        ]);
        return root;
    }

    /**
     * 获取 RAG 问答的 prompt 模板
     * @param userQuestion 用户问题
     * @param topics 相关话题内容
     * @param currentDate 当前日期（可选）
     * @returns 完整的 prompt
     */
    public static getRagAnswerPrompt(userQuestion: string, topics: string, currentDate?: string): CtxTemplateNode {
        const root = new CtxTemplateNode();

        root.insertChildNodeToBack(
            new CtxTemplateNode()
                .setTitle("你的角色")
                .setContentText("你是一个智能助手，请根据以下检索到的话题内容回答用户问题。")
        );

        // 增加当前日期信息
        if (currentDate) {
            root.insertChildNodeToBack(new CtxTemplateNode().setTitle("当前日期时间").setContentText(currentDate));
        }

        root.insertChildNodeToBack(new CtxTemplateNode().setTitle("相关话题").setContentText(topics));

        root.insertChildNodeToBack(new CtxTemplateNode().setTitle("用户问题").setContentText(userQuestion));

        root.insertChildNodeToBack(
            new CtxTemplateNode()
                .setTitle("回答要求")
                .setContentText(
                    ContentUtils.orderedList([
                        "遵从上述话题内容回答问题，考虑话题发生的时间背景",
                        "如果引用了某个话题的内容，请在句子末尾标注来源，格式类似：[话题7] [话题11] [话题23]",
                        "如果话题内容无法回答问题，请如实告知",
                        "回答要系统、完备、结构清晰、客观，且尽量不遗漏信息",
                        "请注意话题发生的时间，考虑时效性对回答的影响",
                        "尽可能保留上述话题内容中出现的外部资源链接"
                    ])
                )
        );

        root.insertChildNodeToBack(new CtxTemplateNode().setTitle("你的任务").setContentText("请开始回答："));

        return root;
    }
}
