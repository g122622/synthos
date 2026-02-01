import type { LogLevel, LogItem, QueryLogsRequest, QueryLogsResponse, QueryLogsErrorResponse } from "@/types/log";

import API_BASE_URL from "./constants/baseUrl";

import fetchWrapper from "@/util/fetchWrapper";

// 导出类型供其他模块使用
export type { LogLevel, LogItem, QueryLogsRequest, QueryLogsResponse, QueryLogsErrorResponse };

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
