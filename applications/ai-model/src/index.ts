import "reflect-metadata";
import Logger from "@root/common/util/Logger";
import {
    registerEventService,
    registerRedisService,
    registerTaskRegistry,
    getEventService,
    getTaskRegistry
} from "@root/common/di/container";
import { activateTaskHandlers } from "@root/common/scheduler/registry/index";
import { bootstrap, bootstrapAll } from "@root/common/util/lifecycle/bootstrap";

import { setupRPC } from "./rpc/setupRPC";
import "./context/middleware/registerAll";
import { registerAllDependencies } from "./di/container";
import "./tasks/AISummarize";
import "./tasks/GenerateEmbedding";
import "./tasks/GenerateReport";
import "./tasks/InterestScore";
import "./tasks/LLMInterestEvaluationAndNotification";

const LOGGER = Logger.withTag("🤖 ai-model-root-script");

/**
 * AI Model 应用入口类
 * 负责初始化 DI 容器、数据库服务、任务处理器和 RPC 服务
 */
@bootstrap
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class AIModelApplication {
    /**
     * 应用主入口
     */
    public async main(): Promise<void> {
        // 1. 注册所有依赖到 DI 容器
        await registerAllDependencies();

        // 2. 初始化事件服务与任务注册中心，并激活任务处理器
        registerRedisService();
        registerEventService();
        registerTaskRegistry();

        await getEventService().init();
        await getTaskRegistry().init();
        await activateTaskHandlers();

        // 初始化 RPC 服务
        await setupRPC();

        LOGGER.success("任务执行器已就绪，等待调度事件");

        // 常驻进程（RPC + 任务事件监听）
        await new Promise<void>(() => {
            // noop
        });
    }
}

// 启动应用
bootstrapAll();
