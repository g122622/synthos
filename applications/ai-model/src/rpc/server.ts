/**
 * RAG RPC Server
 * 基于 tRPC 的 HTTP 服务器
 */
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import {
    createAIModelRootRouter,
    RAGRPCImplementation,
    AITaskImplementation
} from "@root/common/rpc/ai-model/index";
import Logger from "@root/common/util/Logger";
import { WebSocketServer } from "ws";

const LOGGER = Logger.withTag("RAGRPCServer");

/**
 * 启动 AI Model RPC 服务器（合并 RAG Router 与 AI 任务 Router）
 * @param impl 同时实现 RAGRPCImplementation 与 AITaskImplementation 的实现
 * @param port 监听端口
 * @returns HTTP 服务器实例
 */
export function startRAGRPCServer(impl: RAGRPCImplementation & AITaskImplementation, port: number) {
    const router = createAIModelRootRouter(impl);

    const httpServer = createHTTPServer({
        router: router as any
    });

    // 同端口启用 WebSocket（tRPC subscription）
    const wss = new WebSocketServer({ server: httpServer.server });

    applyWSSHandler({ wss, router: router as any });
    LOGGER.success(`RAG RPC WebSocket 已启动，监听端口: ${port}`);

    httpServer.listen(port);
    LOGGER.success(`RAG RPC Server 已启动，监听端口: ${port}`);

    return httpServer;
}
