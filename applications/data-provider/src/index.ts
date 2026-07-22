import "reflect-metadata";
import Logger from "@root/common/util/Logger";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import {
    registerConfigManagerService,
    registerCommonDBService,
    registerImDbAccessService
} from "@root/common/di/container";
import { bootstrap, bootstrapAll } from "@root/common/util/lifecycle/bootstrap";

import { registerTaskHandlers, registerQQProvider } from "./di/container";
import { setupRPC } from "./rpc/setupRPC";

const LOGGER = Logger.withTag("🌏 data-provider-root-script");

/**
 * Data Provider 应用入口类
 * 负责初始化 DI 容器、数据库服务和 RPC 服务
 */
@bootstrap
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class DataProviderApplication {
    /**
     * 应用主入口
     */
    public async main(): Promise<void> {
        // 1. 初始化 DI 容器 - 注册基础服务
        registerConfigManagerService();
        registerCommonDBService();

        // 2. 初始化数据库服务
        const imDbAccessService = new ImDbAccessService();

        await imDbAccessService.init();

        // 3. 注册 ImDbAccessService 到 DI 容器
        registerImDbAccessService(imDbAccessService);

        // 4. 注册 QQProvider
        registerQQProvider();

        // 5. 注册任务处理器与 RPC 实现
        registerTaskHandlers();

        // 6. 启动 RPC 服务
        await setupRPC();

        LOGGER.success("✅ Data Provider 准备就绪");
    }
}

// 启动应用
bootstrapAll();
