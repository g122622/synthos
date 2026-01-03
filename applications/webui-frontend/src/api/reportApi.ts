import API_BASE_URL from "./constants/baseUrl";

import fetchWrapper from "@/util/fetchWrapper";
import { mockConfig } from "@/config/mock";
import {
    mockGetReportById,
    mockGetReportsPaginated,
    mockGetReportsByDate,
    mockGetReportsByTimeRange,
    mockGetRecentReports,
    mockTriggerReportGenerate,
    mockMarkReportAsRead,
    mockUnmarkReportAsRead,
    mockGetReportsReadStatus,
    mockSendReportEmail
} from "@/mock/reportMock";

// 日报类型
export type ReportType = "half-daily" | "weekly" | "monthly";

// 日报统计数据
export interface ReportStatistics {
    topicCount: number;
    mostActiveGroups: string[];
    mostActiveHour: number;
}

// 日报数据
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

// 分页结果
export interface ReportsPaginatedResponse {
    reports: Report[];
    total: number;
    page: number;
    pageSize: number;
}

/**
 * 获取单个日报详情
 */
export const getReportById = async (reportId: string): Promise<ApiResponse<Report>> => {
    // 如果启用了 mock，使用 mock 数据
    if (mockConfig.report) {
        return mockGetReportById(reportId);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/report/${reportId}`);

    return response.json();
};

/**
 * 获取日报列表（分页）
 */
export const getReportsPaginated = async (page: number, pageSize: number, type?: ReportType): Promise<ApiResponse<ReportsPaginatedResponse>> => {
    // 如果启用了 mock，使用 mock 数据
    if (mockConfig.report) {
        return mockGetReportsPaginated(page, pageSize, type);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, pageSize, type })
    });

    return response.json();
};

/**
 * 获取指定日期的半日报
 */
export const getReportsByDate = async (date: string | number): Promise<ApiResponse<Report[]>> => {
    // 如果启用了 mock，使用 mock 数据
    if (mockConfig.report) {
        return mockGetReportsByDate(date);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/reports/by-date`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date })
    });

    return response.json();
};

/**
 * 获取指定时间范围内的日报
 */
export const getReportsByTimeRange = async (timeStart: number, timeEnd: number, type?: ReportType): Promise<ApiResponse<Report[]>> => {
    // 如果启用了 mock，使用 mock 数据
    if (mockConfig.report) {
        return mockGetReportsByTimeRange(timeStart, timeEnd, type);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/reports/by-time-range`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeStart, timeEnd, type })
    });

    return response.json();
};

/**
 * 获取最近的日报
 */
export const getRecentReports = async (type: ReportType, limit: number): Promise<ApiResponse<Report[]>> => {
    // 如果启用了 mock，使用 mock 数据
    if (mockConfig.report) {
        return mockGetRecentReports(type, limit);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/reports/recent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, limit })
    });

    return response.json();
};

// 触发生成日报的响应
export interface TriggerReportGenerateResponse {
    success: boolean;
    message: string;
    reportId?: string;
}

/**
 * 手动触发生成日报
 * @param type 日报类型
 * @param timeStart 可选的开始时间（毫秒时间戳）
 * @param timeEnd 可选的结束时间（毫秒时间戳）
 */
export const triggerReportGenerate = async (type: ReportType, timeStart?: number, timeEnd?: number): Promise<ApiResponse<TriggerReportGenerateResponse>> => {
    // 如果启用了 mock，使用 mock 数据
    if (mockConfig.report) {
        return mockTriggerReportGenerate(type, timeStart, timeEnd);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/reports/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, timeStart, timeEnd })
    });

    return response.json();
};

// ==================== 日报已读状态 ====================

/**
 * 标记日报为已读
 */
export const markReportAsRead = async (reportId: string): Promise<ApiResponse<{ message: string }>> => {
    if (mockConfig.report) {
        return mockMarkReportAsRead(reportId);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/report/read/mark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId })
    });

    return response.json();
};

/**
 * 清除日报的已读状态
 */
export const unmarkReportAsRead = async (reportId: string): Promise<ApiResponse<{ message: string }>> => {
    if (mockConfig.report) {
        return mockUnmarkReportAsRead(reportId);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/report/read/unmark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId })
    });

    return response.json();
};

/**
 * 批量检查日报已读状态
 */
export const getReportsReadStatus = async (reportIds: string[]): Promise<ApiResponse<{ readStatus: Record<string, boolean> }>> => {
    if (mockConfig.report) {
        return mockGetReportsReadStatus(reportIds);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/report/read/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportIds })
    });

    return response.json();
};

// ==================== 日报邮件发送 ====================

/**
 * 发送日报邮件响应
 */
export interface SendReportEmailResponse {
    success: boolean;
    message: string;
}

/**
 * 发送日报邮件到配置的收件人邮箱
 * @param reportId 日报 ID
 */
export const sendReportEmail = async (reportId: string): Promise<ApiResponse<SendReportEmailResponse>> => {
    if (mockConfig.report) {
        return mockSendReportEmail(reportId);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/report/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId })
    });

    return response.json();
};
