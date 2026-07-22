/**
 * Preprocessing RPC Server
 * 基于 tRPC 的 HTTP 服务器（无 subscription，不需要 WebSocket）
 */
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { createPreprocessingRouter, PreprocessingRPCImplementation } from "@root/common/rpc/preprocessing/index";
import Logger from "@root/common/util/Logger";

const LOGGER = Logger.withTag("PreprocessingRPCServer");

/**
 * 启动 Preprocessing RPC 服务器
 * @param impl RPC 实现
 * @param port 监听端口
 * @returns HTTP 服务器实例
 */
export function startPreprocessingRPCServer(impl: PreprocessingRPCImplementation, port: number) {
    const router = createPreprocessingRouter(impl);

    const httpServer = createHTTPServer({
        router: router as any
    });

    httpServer.listen(port);
    LOGGER.success(`Preprocessing RPC Server 已启动，监听端口: ${port}`);

    return httpServer;
}
