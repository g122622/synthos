export class ReportPromptStore {
    /**
     * 获取日报综述生成的 Prompt
     * @param reportType 报告类型
     * @param periodDescription 时间段描述（如 "2024年1月15日上午"）
     * @param topicsData 话题数据（标题和详情）
     * @param statistics 统计数据
     */
    public static getReportSummaryPrompt(
        reportType: 'half-daily' | 'weekly' | 'monthly',
        periodDescription: string,
        topicsData: { topic: string; detail: string }[],
        statistics: { topicCount: number; mostActiveGroups: string[]; mostActiveHour: number }
    ): string {
        const reportTypeName = {
            'half-daily': '半日报',
            'weekly': '周报',
            'monthly': '月报'
        }[reportType];

        const topicsList = topicsData
            .map((t, i) => `${i + 1}. 【${t.topic}】\n   ${t.detail}`)
            .join('\n\n');

        const activeGroupsStr = statistics.mostActiveGroups.length > 0
            ? statistics.mostActiveGroups.join('、')
            : '暂无';

        return `你是一个群聊信息汇总助手，请根据以下话题信息生成一份完备的${reportTypeName}综述。

                ## 时间段
                ${periodDescription}

                ## 统计概览
                - 话题总数：${statistics.topicCount}
                - 最活跃群组：${activeGroupsStr}
                - 最活跃时段：${statistics.mostActiveHour}:00 - ${statistics.mostActiveHour + 1}:00

                ## 话题列表
                ${topicsList}

                ## 要求
                请生成一段完备的、结构清晰的综述文本，要求：
                1. 概括本时段的主要讨论内容和热点话题
                2. 突出最有价值、最有信息量的讨论点
                3. 语言简洁流畅，易于阅读
                4. 使用 Markdown 格式
                5. 不要重复罗列所有话题，而是提炼出核心要点
                6. 如果话题较少或没有特别值得关注的内容，可以简短概括

                请直接输出综述文本，不要添加任何前缀或后缀说明。`;
    }

    /**
     * 获取空日报的默认文本
     */
    public static getEmptyReportText(periodDescription: string): string {
        return `${periodDescription}暂无热门话题讨论。`;
    }
}
