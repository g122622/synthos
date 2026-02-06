/**
 * 兴趣评估提示词存储
 * 提供基于LLM的用户兴趣评估提示词
 */
import { CTX_MIDDLEWARE_TOKENS } from "../middleware/container/container";
import { useMiddleware } from "../middleware/useMiddleware";
import { ContentUtils } from "../template/ContentUtils";
import { CtxTemplateNode } from "../template/CtxTemplate";

export class InterestPromptStore {
    /**
     * 获取LLM兴趣评估提示词
     * @param userInterestDescriptions 用户感兴趣的内容描述列表
     * @param topics 待评估的话题列表，每个话题包含标题和详细内容
     * @returns CtxTemplateNode
     */
    @useMiddleware(CTX_MIDDLEWARE_TOKENS.INJECT_TIME)
    @useMiddleware(CTX_MIDDLEWARE_TOKENS.ADD_BACKGROUND_KNOWLEDGE)
    public static getLLMInterestEvaluationPrompt(
        userInterestDescriptions: string[],
        topics: Array<{ topic: string; detail: string }>
    ): CtxTemplateNode {
        const root = new CtxTemplateNode();

        const userInterestsList = userInterestDescriptions.map(desc => `${desc}`);

        const topicsList = topics
            .map((t, index) => `${index + 1}. 话题标题：${t.topic}\n   详细内容：${t.detail}`)
            .join("\n\n");

        root.setChildNodes([
            new CtxTemplateNode().setTitle("你的角色").setContentText("你是一个用户兴趣评估助手。"),
            new CtxTemplateNode()
                .setTitle("用户感兴趣的内容类型")
                .setContentText(ContentUtils.orderedList(userInterestsList)),
            new CtxTemplateNode().setTitle("待评估的话题").setContentText(topicsList),
            new CtxTemplateNode()
                .setTitle("评估标准")
                .setContentText(
                    ContentUtils.orderedList([
                        "话题内容与“用户感兴趣的内容类型”中的任一项完全符合（如果只有部分相关，则不视为完全符合）",
                        "话题包含的信息对用户可能有实际价值"
                    ])
                ),
            new CtxTemplateNode().setTitle("输出格式要求").setContentText(
                `请严格按照以下JSON格式返回boolean数组，数组长度必须等于话题数量（${topics.length}个）：
                [true, false, true, ...]
                其中true表示在“待评估的话题”列表对应位置处该话题符合用户兴趣，false表示不符合。
                只返回JSON数组，不要添加任何其他文字说明。`
            )
        ]);

        return root;
    }
}
