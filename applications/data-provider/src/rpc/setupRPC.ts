/**
 * 启动 Data Provider RPC Server
 * 使用 DI 容器获取 DataProviderRpcImpl 实例
 */
import { container } from "tsyringe";
import ConfigManagerService from "@root/common/services/config/ConfigManagerService";

import { DATA_PROVIDER_TOKENS } from "../di/tokens";

import { DataProviderRpcImpl } from "./DataProviderRpcImpl";
import { startDataProviderRPCServer } from "./server";

/**
 * 注册并启动 Data Provider RPC Server
 */
export const setupRPC = async () => {
    const config = await ConfigManagerService.getCurrentConfig();

    // 从 DI 容器获取 RPC 实现
    const rpcImpl = container.resolve<DataProviderRpcImpl>(DATA_PROVIDER_TOKENS.DataProviderRpcImpl);

    // 启动 RPC 服务器
    const rpcPort = config.dataProviderRpc.port;

    startDataProviderRPCServer(rpcImpl, rpcPort);
};
