/**
 * RAG RPC 客户端
 * 用于调用 ai-model 子项目的 RPC 服务
 */
import type { RAGRouter } from "@root/common/rpc/ai-model";

import { createTRPCProxyClient, createWSClient, wsLink } from "@trpc/client";
import Logger from "@root/common/util/Logger";
import WebSocket from "ws";

const LOGGER = Logger.withTag("RAGClient");

/**
 * 创建 RAG RPC 客户端
 * @param baseUrl RAG RPC 服务地址，如 "http://localhost:7979"
 * 如果支持 WebSocket，会自动转换为 "ws://localhost:7979" 并使用 WebSocket 连接
 * @returns tRPC 客户端实例
 */
export function createRAGClient(baseUrl: string) {
    // 自动判断并使用 WebSocket
    const wsUrl = baseUrl.replace(/^http/, "ws");

    LOGGER.info(`创建 RAG RPC 客户端 (WebSocket), 服务地址: ${wsUrl}`);

    const wsClient = createWSClient({
        url: wsUrl,
        WebSocket: WebSocket as any
    });

    return createTRPCProxyClient<RAGRouter>({
        links: [
            wsLink({
                client: wsClient
            })
        ]
    });
}

/**
 * RAG 客户端类型
 */
export type RAGClient = ReturnType<typeof createRAGClient>;
