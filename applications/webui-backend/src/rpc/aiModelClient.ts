/**
 * RAG RPC 客户端
 * 用于调用 ai-model 子项目的 RPC 服务
 */
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { RAGRouter } from "@root/common/rpc/ai-model";
import Logger from "@root/common/util/Logger";

const LOGGER = Logger.withTag("RAGClient");

/**
 * 创建 RAG RPC 客户端
 * @param baseUrl RAG RPC 服务地址，如 "http://localhost:7979"
 * @returns tRPC 客户端实例
 */
export function createRAGClient(baseUrl: string) {
    LOGGER.info(`创建 RAG RPC 客户端，服务地址: ${baseUrl}`);

    return createTRPCProxyClient<RAGRouter>({
        links: [
            httpBatchLink({
                url: baseUrl
            })
        ]
    });
}

/**
 * RAG 客户端类型
 */
export type RAGClient = ReturnType<typeof createRAGClient>;
