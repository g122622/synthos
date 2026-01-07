/**
 * 日报类型枚举
 */
export type ReportType = "half-daily" | "weekly" | "monthly";

/**
 * 日报生成状态枚举
 */
export type ReportSummaryStatus = "success" | "failed" | "pending";

/**
 * 日报统计数据接口
 */
export interface ReportStatistics {
    topicCount: number; // 话题总数
    mostActiveGroups: string[]; // 最活跃群组（取三个）
    mostActiveHour: number; // 最活跃时段（小时）
}

/**
 * 日报数据接口
 */
export interface Report {
    reportId: string; // 主键
    type: ReportType; // 报告类型
    timeStart: number; // 统计周期开始时间，毫秒级时间戳
    timeEnd: number; // 统计周期结束时间，毫秒级时间戳

    isEmpty: boolean; // 没有任何话题（或过滤后为空）

    // LLM 生成的综述
    summary: string; // 综述文本
    summaryGeneratedAt: number; // 综述生成时间，毫秒级时间戳
    summaryStatus: ReportSummaryStatus; // 生成状态
    model: string; // 生成综述时的模型名

    // 统计数据
    statistics: ReportStatistics;

    // 关联的话题 ID 列表（用于点击跳转）
    topicIds: string[];

    createdAt: number; // 创建时间，毫秒级时间戳
    updatedAt: number; // 更新时间，毫秒级时间戳
}

/**
 * 数据库中存储的日报记录格式（统计数据和话题ID以JSON字符串存储）
 */
export interface ReportDBRecord {
    reportId: string;
    type: ReportType;
    timeStart: number;
    timeEnd: number;
    isEmpty: number; // SQLite 中用 0/1 表示布尔值
    summary: string | null;
    summaryGeneratedAt: number | null;
    summaryStatus: ReportSummaryStatus;
    model: string | null;
    statisticsJson: string | null; // JSON 字符串
    topicIdsJson: string | null; // JSON 字符串
    createdAt: number;
    updatedAt: number;
}

/**
 * 将数据库记录转换为 Report 对象
 */
export function dbRecordToReport(record: ReportDBRecord): Report {
    return {
        reportId: record.reportId,
        type: record.type,
        timeStart: record.timeStart,
        timeEnd: record.timeEnd,
        isEmpty: record.isEmpty === 1,
        summary: record.summary || "",
        summaryGeneratedAt: record.summaryGeneratedAt || 0,
        summaryStatus: record.summaryStatus,
        model: record.model || "",
        statistics: record.statisticsJson
            ? JSON.parse(record.statisticsJson)
            : { topicCount: 0, mostActiveGroups: [], mostActiveHour: 0 },
        topicIds: record.topicIdsJson ? JSON.parse(record.topicIdsJson) : [],
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
    };
}

/**
 * 将 Report 对象转换为数据库记录
 */
export function reportToDBRecord(report: Report): ReportDBRecord {
    return {
        reportId: report.reportId,
        type: report.type,
        timeStart: report.timeStart,
        timeEnd: report.timeEnd,
        isEmpty: report.isEmpty ? 1 : 0,
        summary: report.summary || null,
        summaryGeneratedAt: report.summaryGeneratedAt || null,
        summaryStatus: report.summaryStatus,
        model: report.model || null,
        statisticsJson: JSON.stringify(report.statistics),
        topicIdsJson: JSON.stringify(report.topicIds),
        createdAt: report.createdAt,
        updatedAt: report.updatedAt
    };
}
