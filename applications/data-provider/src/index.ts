import "reflect-metadata";
import Logger from "@root/common/util/Logger";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { agendaInstance } from "@root/common/scheduler/agenda";
import {
    registerConfigManagerService,
    registerCommonDBService,
    registerImDbAccessService
} from "@root/common/di/container";
import { bootstrap, bootstrapAll } from "@root/common/util/lifecycle/bootstrap";

import {
    registerTaskHandlers,
    getProvideDataTaskHandler,
    registerQQProvider,
    registerOneBotFileProvider
} from "./di/container";

const LOGGER = Logger.withTag("🌏 data-provider-root-script");

/**
 * Data Provider 应用入口类
 * 负责初始化 DI 容器、数据库服务和任务处理器
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
        registerOneBotFileProvider();

        // 5. 注册任务处理器
        registerTaskHandlers();

        // 6. 获取任务处理器并注册到 Agenda
        const provideDataTaskHandler = getProvideDataTaskHandler();

        await provideDataTaskHandler.register();

        LOGGER.success("Ready to start agenda scheduler");
        await agendaInstance.start(); // 启动调度器
    }
}

// 启动应用
bootstrapAll();
