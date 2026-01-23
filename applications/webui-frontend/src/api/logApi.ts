import API_BASE_URL from "./constants/baseUrl";

import fetchWrapper from "@/util/fetchWrapper";

export type LogLevel = "debug" | "info" | "success" | "warning" | "error";

export interface LogItem {
    timestamp: number;
    level: LogLevel;
    raw: string;
    sourceFile: string;
}

export interface QueryLogsRequest {
    limit: number;
    before?: number;
    startTime?: number;
    endTime?: number;
    levels?: LogLevel[];
}

export interface QueryLogsResponse {
    success: true;
    data: {
        items: LogItem[];
        nextBefore: number | null;
        hasMore: boolean;
    };
}

export interface QueryLogsErrorResponse {
    success: false;
    message?: string;
    error?: string;
}

export async function queryLogs(params: QueryLogsRequest): Promise<QueryLogsResponse | QueryLogsErrorResponse> {
    const response = await fetchWrapper(`${API_BASE_URL}/api/logs/query`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(params)
    });

    return response.json();
}
