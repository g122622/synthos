import API_BASE_URL from "./constants/baseUrl";

import fetchWrapper from "@/util/fetchWrapper";
import { mockConfig } from "@/config/mock";
import {
    mockGetReportById,
    mockGetReportsPaginated,
    mockGetReportsByDate,
    mockGetReportsByTimeRange,
    mockGetRecentReports
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
