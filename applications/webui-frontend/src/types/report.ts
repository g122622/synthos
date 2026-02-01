/**
 * 报告相关的类型定义
 */

import type { TopicReferenceItem } from "./topicReference";

/**
 * 日报类型
 */
export type ReportType = "half-daily" | "weekly" | "monthly";

/**
 * 日报统计数据
 */
export interface ReportStatistics {
    topicCount: number;
    mostActiveGroups: string[];
    mostActiveHour: number;
}

/**
 * 日报数据
 */
export interface Report {
    reportId: string;
    type: ReportType;
    timeStart: number;
    timeEnd: number;
    isEmpty: boolean;
    summary: string;
    summaryGeneratedAt: number;
    summaryStatus: "success" | "failed" | "pending";
    model: string;
    statistics: ReportStatistics;
    topicIds: string[];
    createdAt: number;
    updatedAt: number;
}

/**
 * 日报详情
 */
export interface ReportDetail {
    report: Report;
    references: TopicReferenceItem[];
}

/**
 * 日报分页响应
 */
export interface ReportsPaginatedResponse {
    reports: Report[];
    total: number;
    page: number;
    pageSize: number;
}

/**
 * 触发日报生成响应
 */
export interface TriggerReportGenerateResponse {
    success: boolean;
    message: string;
    reportId?: string;
}

/**
 * 发送日报邮件响应
 */
export interface SendReportEmailResponse {
    success: boolean;
    message: string;
}
