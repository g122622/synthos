/**
 * RAG RPC Server
 * 基于 tRPC 的 HTTP 服务器
 */
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { createRAGRouter, RAGRPCImplementation } from "@root/common/rpc/ai-model/index";
import Logger from "@root/common/util/Logger";

const LOGGER = Logger.withTag("RAGRPCServer");

/**
 * 启动 RAG RPC 服务器
 * @param impl RPC 实现
 * @param port 监听端口
 * @returns HTTP 服务器实例
 */
export function startRAGRPCServer(impl: RAGRPCImplementation, port: number) {
    const router = createRAGRouter(impl);

    const server = createHTTPServer({
        router: router as any
    });

    server.listen(port);
    LOGGER.success(`RAG RPC Server 已启动，监听端口: ${port}`);

    return server;
}
