import { CTX_MIDDLEWARE_TOKENS } from "../middleware/container/container";
import { useMiddleware } from "../middleware/useMiddleware";
import { ContentUtils } from "../template/ContentUtils";
import { CtxTemplateNode } from "../template/CtxTemplate";

export class ReportPromptStore {
    /**
     * 获取日报综述生成的 Prompt
     * @param reportType 报告类型
     * @param periodDescription 时间段描述（如 "2024年1月15日上午"）
     * @param topicsData 话题数据（标题和详情）
     * @param statistics 统计数据
     */
    @useMiddleware(CTX_MIDDLEWARE_TOKENS.ADD_BACKGROUND_KNOWLEDGE)
    public static async getReportSummaryPrompt(
        reportType: "half-daily" | "weekly" | "monthly",
        periodDescription: string,
        topicsData: { topic: string; detail: string }[],
        statistics: { topicCount: number; mostActiveGroups: string[]; mostActiveHour: number }
    ): Promise<CtxTemplateNode> {
        const root = new CtxTemplateNode();

        const reportTypeName = {
            "half-daily": "半日报",
            weekly: "周报",
            monthly: "月报"
        }[reportType];

        const topicsList = topicsData.map((t, i) => `${i + 1}. 【${t.topic}】\n   ${t.detail}`).join("\n\n");

        const activeGroupsStr =
            statistics.mostActiveGroups.length > 0 ? statistics.mostActiveGroups.join("、") : "暂无";

        root.setChildNodes([
            new CtxTemplateNode()
                .setTitle("你的角色")
                .setContentText(
                    `你是一个群聊信息汇总助手，请根据以下话题信息生成一份精美的、完备的、略带趣味性的、结构清晰的${reportTypeName}综述。`
                ),
            new CtxTemplateNode().setTitle("时间段").setContentText(periodDescription),
            new CtxTemplateNode()
                .setTitle("统计概览")
                .setContentText(
                    ContentUtils.unorderedList([
                        `话题总数：${statistics.topicCount}`,
                        `最活跃群组：${activeGroupsStr}`,
                        `最活跃时段：${statistics.mostActiveHour}:00 - ${((statistics.mostActiveHour + 1) % 24).toString().padStart(2, "0")}:00`
                    ])
                ),
            new CtxTemplateNode().setTitle("话题列表").setContentText(topicsList),
            new CtxTemplateNode()
                .setTitle("要求")
                .setContentText(
                    ContentUtils.orderedList([
                        "概括本时段的主要讨论内容和热点话题",
                        "突出最有价值、最有信息量的讨论点",
                        "语言简洁流畅，易于阅读",
                        "使用 Markdown 格式",
                        "不要重复罗列所有话题，而是提炼出核心要点",
                        "如果引用了某个话题的内容，请在句子末尾标注来源，格式类似：[话题7] [话题11] [话题23]",
                        "标注中的数字 N 为 1-based，并严格对应上方“话题列表”的序号（第 N 条话题即 [话题N]）",
                        "如果话题较少或没有特别值得关注的内容，可以简短概括",
                        "请直接输出综述文本，不要添加任何前缀或后缀说明"
                    ])
                )
        ]);

        return root;
    }

    /**
     * 获取空日报的默认文本 TODO 把此函数移出这个文件
     */
    public static getEmptyReportText(periodDescription: string): string {
        return `${periodDescription}暂无热门话题讨论。`;
    }
}
