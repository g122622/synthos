/**
 * 日志相关的类型定义
 */

/**
 * 日志级别
 */
export type LogLevel = "debug" | "info" | "success" | "warning" | "error";

/**
 * 日志项
 */
export interface LogItem {
    timestamp: number;
    level: LogLevel;
    raw: string;
    sourceFile: string;
}

/**
 * 查询日志请求参数
 */
export interface QueryLogsRequest {
    limit: number;
    before?: number;
    startTime?: number;
    endTime?: number;
    levels?: LogLevel[];
}

/**
 * 查询日志响应（成功）
 */
export interface QueryLogsResponse {
    success: true;
    data: {
        items: LogItem[];
        nextBefore: number | null;
        hasMore: boolean;
    };
}

/**
 * 查询日志响应（错误）
 */
export interface QueryLogsErrorResponse {
    success: false;
    message?: string;
    error?: string;
}
