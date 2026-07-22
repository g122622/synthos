/**
 * 启动 Preprocessing RPC Server
 * 使用 DI 容器获取 PreprocessingRpcImpl 实例
 */
import { container } from "tsyringe";
import ConfigManagerService from "@root/common/services/config/ConfigManagerService";

import { PREPROCESSING_TOKENS } from "../di/tokens";

import { PreprocessingRpcImpl } from "./PreprocessingRpcImpl";
import { startPreprocessingRPCServer } from "./server";

/**
 * 注册并启动 Preprocessing RPC Server
 */
export const setupRPC = async () => {
    const config = await ConfigManagerService.getCurrentConfig();

    // 从 DI 容器获取 RPC 实现
    const rpcImpl = container.resolve<PreprocessingRpcImpl>(PREPROCESSING_TOKENS.PreprocessingRpcImpl);

    // 启动 RPC 服务器
    const rpcPort = config.preprocessingRpc.port;

    startPreprocessingRPCServer(rpcImpl, rpcPort);
};
