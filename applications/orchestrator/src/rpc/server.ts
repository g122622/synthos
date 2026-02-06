/**
 * Orchestrator RPC Server
 * 基于 tRPC 的 HTTP 服务器
 */
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { createOrchestratorRouter, OrchestratorRPCImplementation } from "@root/common/rpc/orchestrator/index";
import Logger from "@root/common/util/Logger";
import { WebSocketServer } from "ws";

const LOGGER = Logger.withTag("🎭 OrchestratorRPCServer");

/**
 * 启动 Orchestrator RPC 服务器
 * @param impl RPC 实现
 * @param port 监听端口
 * @returns HTTP 服务器实例
 */
export function startOrchestratorRPCServer(impl: OrchestratorRPCImplementation, port: number) {
    const router = createOrchestratorRouter(impl);

    const httpServer = createHTTPServer({
        router: router as any
    });

    // 同端口启用 WebSocket（tRPC subscription）
    const wss = new WebSocketServer({ server: httpServer.server });

    applyWSSHandler({ wss, router: router as any });
    LOGGER.success(`Orchestrator RPC WebSocket 已启动，监听端口: ${port}`);

    httpServer.listen(port);
    LOGGER.success(`Orchestrator RPC Server 已启动，监听端口: ${port}`);

    return httpServer;
}
