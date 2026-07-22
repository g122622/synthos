/**
 * Orchestrator RPC 客户端
 * 用于调用各 worker app（data-provider / preprocessing / ai-model）的 tRPC 服务
 * 统一使用 httpLink（同步 request/response，不走 wsLink/subscription）
 */
import type { DataProviderRouter } from "@root/common/rpc/data-provider/index";
import type { PreprocessingRouter } from "@root/common/rpc/preprocessing/index";
import type { AIRootRouter } from "@root/common/rpc/ai-model/index";

import { createTRPCProxyClient, httpLink } from "@trpc/client";
import Logger from "@root/common/util/Logger";

const LOGGER = Logger.withTag("OrchestratorClients");

/** data-provider 客户端类型 */
export type DataProviderClient = ReturnType<typeof createDataProviderClient>;
/** preprocessing 客户端类型 */
export type PreprocessingClient = ReturnType<typeof createPreprocessingClient>;
/** ai-model 客户端类型 */
export type AIModelClient = ReturnType<typeof createAIModelClient>;

/**
 * 创建 data-provider tRPC 客户端
 * @param baseUrl 服务地址，如 "http://localhost:7980"
 */
export function createDataProviderClient(baseUrl: string) {
    LOGGER.info(`创建 data-provider 客户端 (httpLink), 服务地址: ${baseUrl}`);

    return createTRPCProxyClient<DataProviderRouter>({
        links: [httpLink({ url: baseUrl })]
    });
}

/**
 * 创建 preprocessing tRPC 客户端
 * @param baseUrl 服务地址，如 "http://localhost:7981"
 */
export function createPreprocessingClient(baseUrl: string) {
    LOGGER.info(`创建 preprocessing 客户端 (httpLink), 服务地址: ${baseUrl}`);

    return createTRPCProxyClient<PreprocessingRouter>({
        links: [httpLink({ url: baseUrl })]
    });
}

/**
 * 创建 ai-model tRPC 客户端
 * @param baseUrl 服务地址，如 "http://localhost:7979"
 */
export function createAIModelClient(baseUrl: string) {
    LOGGER.info(`创建 ai-model 客户端 (httpLink), 服务地址: ${baseUrl}`);

    return createTRPCProxyClient<AIRootRouter>({
        links: [httpLink({ url: baseUrl })]
    });
}
