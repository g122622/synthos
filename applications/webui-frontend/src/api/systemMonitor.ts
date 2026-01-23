// api/systemMonitor.ts
import API_BASE_URL from "./constants/baseUrl";

import fetchWrapper from "@/util/fetchWrapper";
import { mockConfig } from "@/config/mock";
import { mockGetLatestSystemStats, mockGetSystemStatsHistory } from "@/mock/systemMonitorMock";

export interface SystemStats {
    timestamp: number;
    storage: {
        chatRecordDB: { count: number; size: number };
        imMessageFtsDB: { count: number; size: number };
        aiDialogueDB: { count: number; size: number };
        vectorDB: { count: number; size: number };
        kvStoreBackend: { count: number; size: number };
        kvStorePersistent: { count: number; size: number };
        logs: { count: number; size: number };
        totalSize: number;
    };
    modules: Record<string, { cpu: number; memory: number }>;
}

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
