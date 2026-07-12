import { CTX_MIDDLEWARE_TOKENS } from "../middleware/container/container";
import { useMiddleware } from "../middleware/useMiddleware";
import { ContentUtils } from "../template/ContentUtils";
import { CtxTemplateNode } from "../template/CtxTemplate";

/**
 * 群友个人画像 PromptStore
 * 零外部依赖、无状态，仅负责构建画像 prompt 的 CtxTemplateNode 树
 */
export class MemberProfilePromptStore {
    @useMiddleware(CTX_MIDDLEWARE_TOKENS.INJECT_TIME)
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

    /**
     * 构建画像汇总（merge）prompt
     * 当话题过多分片生成多份子画像后，用本方法把各子画像聚合成汇总 prompt，
     * 交叉验证、去重、整合为一份最终画像；冲突信息全部保留并标注
     * @param nickname 群友昵称（仅展示）
     * @param subProfilesAggregate 各子画像的聚合文本（由 CtxBuilder 序列化为【子画像N】{...} 形式）
     * @returns 汇总 prompt 的 CtxTemplateNode 树
     */
    @useMiddleware(CTX_MIDDLEWARE_TOKENS.INJECT_TIME)
    @useMiddleware(CTX_MIDDLEWARE_TOKENS.ADD_BACKGROUND_KNOWLEDGE)
    public static async getMemberProfileMergePrompt(
        nickname: string,
        subProfilesAggregate: string
    ): Promise<CtxTemplateNode> {
        const root = new CtxTemplateNode();

        root.setChildNodes([
            new CtxTemplateNode()
                .setTitle("你的任务")
                .setContentText(
                    `你是一个群聊用户画像整合助手。由于群友（昵称：${nickname}）参与的话题过多，已先分组生成了多份子画像。请对以下多份子画像进行交叉验证、去重、整合，输出一份信息更完整、丰富、准确的最终个人画像。`
                ),
            new CtxTemplateNode().setTitle("待整合的子画像").setContentText(subProfilesAggregate),
            new CtxTemplateNode()
                .setTitle("整合规则")
                .setContentText(
                    ContentUtils.unorderedList([
                        "对同一字段：若多份子画像给出一致信息，整合保留并适当丰富；若信息互补则合并",
                        "若多份子画像对同一字段给出相互冲突的信息，必须把所有冲突的取值都保留下来，并用明显的文字标注这是冲突情况，例如：「（存在冲突：A子画像记为X，B子画像记为Y，原因可能为…）」，不要二选一舍弃任何一方",
                        "若某字段在所有子画像中均为 null，最终结果该字段也为 null，不要编造",
                        "保留各子画像中出现的关键信息（学校名、公司名、研究方向等）",
                        "整合后信息应比单份子画像更完整、丰富和准确"
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
