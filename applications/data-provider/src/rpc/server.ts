/**
 * Data Provider RPC Server
 * 基于 tRPC 的 HTTP 服务器（无 subscription，不需要 WebSocket）
 */
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { createDataProviderRouter, DataProviderRPCImplementation } from "@root/common/rpc/data-provider/index";
import Logger from "@root/common/util/Logger";

const LOGGER = Logger.withTag("DataProviderRPCServer");

/**
 * 启动 Data Provider RPC 服务器
 * @param impl RPC 实现
 * @param port 监听端口
 * @returns HTTP 服务器实例
 */
export function startDataProviderRPCServer(impl: DataProviderRPCImplementation, port: number) {
    const router = createDataProviderRouter(impl);

    const httpServer = createHTTPServer({
        router: router as any
    });

    httpServer.listen(port);
    LOGGER.success(`Data Provider RPC Server 已启动，监听端口: ${port}`);

    return httpServer;
}
