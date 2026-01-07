import { startRAGRPCServer } from "./server";
import { getRagRPCImpl } from "../di/container";
import ConfigManagerService from "@root/common/services/config/ConfigManagerService";

/**
 * 启动 RPC Server
 * 使用 DI 容器获取 RagRPCImpl 实例
 */
export const setupRPC = async () => {
    const config = await ConfigManagerService.getCurrentConfig();

    // 从 DI 容器获取 RPC 实现
    const rpcImpl = getRagRPCImpl();

    // 初始化 RPC 实现
    await rpcImpl.init();

    // 启动 RPC 服务器
    const rpcPort = config.ai.rpc.port;
    startRAGRPCServer(rpcImpl, rpcPort);
};
