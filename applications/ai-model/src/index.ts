import "reflect-metadata";
import Logger from "@root/common/util/Logger";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { bootstrap, bootstrapAll } from "@root/common/util/lifecycle/bootstrap";
import { setupRPC } from "./rpc/setupRPC";
import "./context/middleware/registerAll";
import { registerAllDependencies } from "./di/container";

const LOGGER = Logger.withTag("🤖 ai-model-root-script");

/**
 * AI Model 应用入口类
 * 负责初始化 DI 容器、数据库服务、任务处理器和 RPC 服务
 */
@bootstrap
class AIModelApplication {
    /**
     * 应用主入口
     */
    public async main(): Promise<void> {
        await registerAllDependencies();
        
        // 初始化 RPC 服务
        await setupRPC();

        LOGGER.success("Ready to start agenda scheduler");
        await agendaInstance.start(); // 启动调度器
    }
}

// 启动应用
bootstrapAll();
