/**
 * System Monitor 模块模拟数据
 * 用于在只启动前端时展示 UI 效果
 */

import type { SystemStats } from "@/api/systemMonitor";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const buildStats = (timestamp: number, factor: number): SystemStats => {
    const mb = (n: number) => Math.floor(n * 1024 * 1024);

    const chatCount = Math.floor(50000 * factor);
    const imCount = Math.floor(200000 * factor);
    const aiCount = Math.floor(1200 * factor);
    const vectorCount = Math.floor(8000 * factor);

    const chatSize = mb(120 * factor);
    const imSize = mb(680 * factor);
    const aiSize = mb(90 * factor);
    const vectorSize = mb(420 * factor);
    const kvBackendSize = mb(12 * factor);
    const kvPersistentSize = mb(36 * factor);
    const logsSize = mb(48 * factor);

    const totalSize = chatSize + imSize + aiSize + vectorSize + kvBackendSize + kvPersistentSize + logsSize;

    return {
        timestamp,
        storage: {
            chatRecordDB: { count: chatCount, size: chatSize },
            imMessageFtsDB: { count: imCount, size: imSize },
            aiDialogueDB: { count: aiCount, size: aiSize },
            vectorDB: { count: vectorCount, size: vectorSize },
            kvStoreBackend: { count: 1200, size: kvBackendSize },
            kvStorePersistent: { count: 3200, size: kvPersistentSize },
            logs: { count: 500, size: logsSize },
            totalSize
        },
        modules: {
            "webui-backend": { cpu: Math.round(8 * factor * 10) / 10, memory: Math.round(220 * factor) },
            "data-provider": { cpu: Math.round(12 * factor * 10) / 10, memory: Math.round(360 * factor) },
            orchestrator: { cpu: Math.round(6 * factor * 10) / 10, memory: Math.round(180 * factor) },
            preprocessing: { cpu: Math.round(4 * factor * 10) / 10, memory: Math.round(140 * factor) }
        }
    };
};

export const mockGetLatestSystemStats = async (): Promise<SystemStats> => {
    await delay(250 + Math.random() * 200);

    return buildStats(Date.now(), 1);
};

export const mockGetSystemStatsHistory = async (): Promise<SystemStats[]> => {
    await delay(300 + Math.random() * 200);

    const now = Date.now();
    const points = 24;
    const step = 60 * 60 * 1000;

    const list: SystemStats[] = [];

    for (let i = points - 1; i >= 0; i--) {
        const ts = now - i * step;
        const factor = 0.85 + Math.random() * 0.3;

        list.push(buildStats(ts, factor));
    }

    return list;
};
