/**
 * 初始化并等待 orchestrator 所需的三个 worker client 就绪
 * 替代原 orchestrator 启动时的 sleep(10s) hack
 */
import ConfigManagerService from "@root/common/services/config/ConfigManagerService";
import Logger from "@root/common/util/Logger";
import { sleep } from "@root/common/util/promisify/sleep";

import {
    createDataProviderClient,
    createPreprocessingClient,
    createAIModelClient,
    DataProviderClient,
    PreprocessingClient,
    AIModelClient
} from "./clients";

const LOGGER = Logger.withTag("OrchestratorSetupClients");

/** 三个 client 的集合 */
export interface WorkerClients {
    dataProvider: DataProviderClient;
    preprocessing: PreprocessingClient;
    aiModel: AIModelClient;
}

/** 等待单个端口可达（HTTP 探测） */
async function waitForPort(name: string, url: string, maxAttempts: number, intervalMs: number): Promise<boolean> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const res = await fetch(url);

            // tRPC 未知路径通常返回 404，只要 TCP/HTTP 通了就算就绪
            if (res.status === 404 || res.ok) {
                LOGGER.success(`${name} 服务就绪 (${url})`);

                return true;
            }
        } catch {
            // 连接失败，继续重试
        }

        LOGGER.debug(`${name} 尚未就绪，第 ${attempt}/${maxAttempts} 次重试...`);
        await sleep(intervalMs);
    }

    return false;
}

/**
 * 创建三个 client 并等待对应服务就绪
 * @returns 三个 client 实例
 */
export async function setupClients(): Promise<WorkerClients> {
    const config = await ConfigManagerService.getCurrentConfig();

    const dataProviderUrl = `http://localhost:${config.dataProviderRpc.port}`;
    const preprocessingUrl = `http://localhost:${config.preprocessingRpc.port}`;
    const aiModelUrl = `http://localhost:${config.ai.rpc.port}`;

    const dataProvider = createDataProviderClient(dataProviderUrl);
    const preprocessing = createPreprocessingClient(preprocessingUrl);
    const aiModel = createAIModelClient(aiModelUrl);

    // 等待三个服务就绪（最多 ~2 分钟）
    const MAX_ATTEMPTS = 60;
    const INTERVAL_MS = 2000;

    LOGGER.info("等待各 worker 服务就绪...");

    const results = await Promise.all([
        waitForPort("data-provider", dataProviderUrl, MAX_ATTEMPTS, INTERVAL_MS),
        waitForPort("preprocessing", preprocessingUrl, MAX_ATTEMPTS, INTERVAL_MS),
        waitForPort("ai-model", aiModelUrl, MAX_ATTEMPTS, INTERVAL_MS)
    ]);

    const notReady = [
        results[0] ? null : "data-provider",
        results[1] ? null : "preprocessing",
        results[2] ? null : "ai-model"
    ].filter(Boolean);

    if (notReady.length > 0) {
        throw new Error(`以下 worker 服务未在超时时间内就绪: ${notReady.join(", ")}`);
    }

    LOGGER.success("所有 worker 服务就绪");

    return { dataProvider, preprocessing, aiModel };
}
