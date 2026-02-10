import "reflect-metadata";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import Logger from "@root/common/util/Logger";
import {
    registerConfigManagerService,
    registerCommonDBService,
    registerImDbAccessService,
    registerRedisService,
    registerEventService,
    registerTaskRegistry,
    getEventService,
    getTaskRegistry
} from "@root/common/di/container";
import { activateTaskHandlers } from "@root/common/scheduler/registry/index";
import { bootstrap, bootstrapAll } from "@root/common/util/lifecycle/bootstrap";

import { registerTaskHandlers, registerAccumulativeSplitter, registerTimeoutSplitter } from "./di/container";

const LOGGER = Logger.withTag("🏭 preprocessor-root-script");

/**
 * Preprocessing 应用入口类
 * 负责初始化 DI 容器、数据库服务和任务处理器
 */
@bootstrap
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class PreprocessingApplication {
    /**
     * 应用主入口
     */
    public async main(): Promise<void> {
        // 1. 初始化 DI 容器 - 注册基础服务
        registerConfigManagerService();
        registerCommonDBService();
        registerRedisService();
        registerEventService();
        registerTaskRegistry();

        // 2. 初始化数据库服务
        const imDbAccessService = new ImDbAccessService();

        await imDbAccessService.init();

        // 3. 注册 ImDbAccessService 到 DI 容器
        registerImDbAccessService(imDbAccessService);

        // 4. 注册分割器
        registerAccumulativeSplitter();
        registerTimeoutSplitter();

        // 5. 注册任务处理器
        registerTaskHandlers();

        // 6. 初始化事件服务与任务注册中心，并激活任务处理器
        await getEventService().init();
        await getTaskRegistry().init();
        await activateTaskHandlers();

        LOGGER.success("任务执行器已就绪，等待调度事件");

        // 常驻进程
        await new Promise<void>(() => {
            // noop
        });
    }
}

// 启动应用
bootstrapAll();
