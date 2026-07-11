import { CTX_MIDDLEWARE_TOKENS } from "../middleware/container/container";
import { useMiddleware } from "../middleware/useMiddleware";
import { ContentUtils } from "../template/ContentUtils";
import { CtxTemplateNode } from "../template/CtxTemplate";

/**
 * 群友个人画像 PromptStore
 * 零外部依赖、无状态，仅负责构建画像 prompt 的 CtxTemplateNode 树
 */
export class MemberProfilePromptStore {
    @useMiddleware(CTX_MIDDLEWARE_TOKENS.ADD_BACKGROUND_KNOWLEDGE)
    public static async getMemberProfilePrompt(
        nickname: string,
        topicsAggregate: string
    ): Promise<CtxTemplateNode> {
        const root = new CtxTemplateNode();

        root.setChildNodes([
            new CtxTemplateNode()
                .setTitle("你的任务")
                .setContentText(
                    `你是一个群聊用户画像分析助手。请根据以下某位群友（昵称：${nickname}）参与的所有话题摘要，总结出该群友的结构化个人画像。`
                ),
            new CtxTemplateNode().setTitle("该群友参与的话题摘要聚合").setContentText(topicsAggregate),
            new CtxTemplateNode()
                .setTitle("分析维度")
                .setContentText(
                    ContentUtils.unorderedList([
                        "school：学校/教育背景",
                        "company：公司/工作单位",
                        "domain：专业领域/研究方向",
                        "experience：经历（科研/实习/求职等）",
                        "interests：兴趣/关注点",
                        "communicationStyle：沟通风格"
                    ])
                ),
            new CtxTemplateNode()
                .setTitle("注意")
                .setContentText(
                    ContentUtils.unorderedList([
                        "只根据上述话题摘要内容推断，不要臆测或编造",
                        "某字段信息不足时填 null，不要编造",
                        "昵称可能是QQ昵称、群昵称或真实姓名，仅作展示参考",
                        "保留话题中出现的关键信息（学校名、公司名、研究方向等）",
                        "跨群组合信息：同一群友在不同群的话题都要纳入分析"
                    ])
                ),
            new CtxTemplateNode().setTitle("输出格式要求").setContentText(`
                    重要：必须返回标准JSON格式，严格遵守以下规则：
                    1. 只使用英文双引号 " 不要使用中文引号
                    2. 字符串内容中的引号必须转义为 \\"\\"
                    3. 不要在JSON外添加任何文字说明
                    4. 信息不足的字段值设为 null

                    请严格按照以下JSON格式返回，确保可以被标准JSON解析器解析：
                    {
                        "school": "学校或null",
                        "company": "公司或null",
                        "domain": "领域或null",
                        "experience": "经历或null",
                        "interests": "兴趣或null",
                        "communicationStyle": "沟通风格或null"
                    }`)
        ]);

        return root;
    }
}
