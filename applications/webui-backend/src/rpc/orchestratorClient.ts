/**
 * Orchestrator RPC 客户端
 * 用于调用 orchestrator 子项目的 RPC 服务
 */
import type { OrchestratorRouter } from "@root/common/rpc/orchestrator";

import { createTRPCProxyClient, createWSClient, wsLink } from "@trpc/client";
import Logger from "@root/common/util/Logger";
import WebSocket from "ws";

const LOGGER = Logger.withTag("🎭 OrchestratorClient");

/**
 * 创建 Orchestrator RPC 客户端
 * @param baseUrl Orchestrator RPC 服务地址，如 "http://localhost:8080"
 * 如果支持 WebSocket，会自动转换为 "ws://localhost:8080" 并使用 WebSocket 连接
 * @returns tRPC 客户端实例
 */
export function createOrchestratorClient(baseUrl: string) {
    // 自动判断并使用 WebSocket
    const wsUrl = baseUrl.replace(/^http/, "ws");

    LOGGER.info(`创建 Orchestrator RPC 客户端 (WebSocket), 服务地址: ${wsUrl}`);

    const wsClient = createWSClient({
        url: wsUrl,
        WebSocket: WebSocket as any
    });

    // @ts-ignore - tRPC 类型推断问题，运行时正常工作
    return createTRPCProxyClient<OrchestratorRouter>({
        links: [
            wsLink({
                client: wsClient
            })
        ]
    });
}

/**
 * Orchestrator 客户端类型
 */
export type OrchestratorClient = ReturnType<typeof createOrchestratorClient>;
