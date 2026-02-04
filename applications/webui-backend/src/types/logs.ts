/**
 * 日志相关类型定义
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
 * 查询日志参数
 */
export interface QueryLogsParams {
    limit: number;
    before?: number;
    startTime?: number;
    endTime?: number;
    levels?: LogLevel[];
}

/**
 * 查询日志结果
 */
export interface QueryLogsResult {
    items: LogItem[];
    nextBefore: number | null;
    hasMore: boolean;
}

/**
 * 日志文件信息（内部使用）
 */
export interface LogFileInfo {
    fileName: string;
    dayStartMs: number;
}
