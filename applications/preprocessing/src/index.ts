import "reflect-metadata";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import Logger from "@root/common/util/Logger";
import { agendaInstance } from "@root/common/scheduler/agenda";
import {
    registerConfigManagerService,
    registerImDbAccessService
} from "@root/common/di/container";
import { registerTaskHandlers, getPreprocessTaskHandler } from "./di/container";
import { bootstrap, bootstrapAll } from "@root/common/util/lifecycle/bootstrap";

const LOGGER = Logger.withTag("🏭 preprocessor-root-script");

/**
 * Preprocessing 应用入口类
 * 负责初始化 DI 容器、数据库服务和任务处理器
 */
@bootstrap
class PreprocessingApplication {
    /**
     * 应用主入口
     */
    public async main(): Promise<void> {
        // 1. 初始化 DI 容器 - 注册基础服务
        registerConfigManagerService();

        // 2. 初始化数据库服务
        const imDbAccessService = new ImDbAccessService();
        await imDbAccessService.init();

        // 3. 注册 ImDbAccessService 到 DI 容器
        registerImDbAccessService(imDbAccessService);

        // 4. 注册任务处理器
        registerTaskHandlers();

        // 5. 获取任务处理器并注册到 Agenda
        const preprocessTaskHandler = getPreprocessTaskHandler();
        await preprocessTaskHandler.register();

        LOGGER.success("Ready to start agenda scheduler");
        await agendaInstance.start(); // 启动调度器
    }
}

// 启动应用
bootstrapAll();
