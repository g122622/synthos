// api/systemMonitor.ts
import type { SystemStats } from "@/types/system";

import API_BASE_URL from "./constants/baseUrl";

import fetchWrapper from "@/util/fetchWrapper";
import { mockConfig } from "@/config/mock";
import { mockGetLatestSystemStats, mockGetSystemStatsHistory } from "@/mock/systemMonitorMock";

// 导出类型供其他模块使用
export type { SystemStats };

export const getLatestSystemStats = async (): Promise<SystemStats> => {
    if (mockConfig.systemMonitor) {
        return mockGetLatestSystemStats();
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/system/monitor/latest`);

    return response.json();
};

export const getSystemStatsHistory = async (): Promise<SystemStats[]> => {
    if (mockConfig.systemMonitor) {
        return mockGetSystemStatsHistory();
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/system/monitor/history`);

    return response.json();
};
