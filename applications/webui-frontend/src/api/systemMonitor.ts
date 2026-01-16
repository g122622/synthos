// api/systemMonitor.ts
import API_BASE_URL from "./constants/baseUrl";

import fetchWrapper from "@/util/fetchWrapper";

export interface SystemStats {
    timestamp: number;
    storage: {
        chatRecordDB: { count: number; size: number };
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
    const response = await fetchWrapper(`${API_BASE_URL}/api/system/monitor/latest`);

    return response.json();
};

export const getSystemStatsHistory = async (): Promise<SystemStats[]> => {
    const response = await fetchWrapper(`${API_BASE_URL}/api/system/monitor/history`);

    return response.json();
};
