import "reflect-metadata";
import Logger from "@root/common/util/Logger";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { bootstrap, bootstrapAll } from "@root/common/util/lifecycle/bootstrap";
import { setupRPC } from "./rpc/setupRPC";
import "./context/middleware/registerAll";
import { registerAllDependencies } from "./di/container";
import { container } from "tsyringe";
import { AI_MODEL_TOKENS } from "./di/tokens";
import { AISummarizeTaskHandler } from "./tasks/AISummarize";
import { GenerateEmbeddingTaskHandler } from "./tasks/GenerateEmbedding";
import { GenerateReportTaskHandler } from "./tasks/GenerateReport";
import { InterestScoreTaskHandler } from "./tasks/InterestScore";

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
        // 1. 注册所有依赖到 DI 容器
        await registerAllDependencies();

        // 2. 注册各大任务到 Agenda 调度器
        await container.resolve<AISummarizeTaskHandler>(AI_MODEL_TOKENS.AISummarizeTaskHandler).register();
        await container.resolve<InterestScoreTaskHandler>(AI_MODEL_TOKENS.InterestScoreTaskHandler).register();
        await container
            .resolve<GenerateEmbeddingTaskHandler>(AI_MODEL_TOKENS.GenerateEmbeddingTaskHandler)
            .register();
        await container.resolve<GenerateReportTaskHandler>(AI_MODEL_TOKENS.GenerateReportTaskHandler).register();

        // 初始化 RPC 服务
        await setupRPC();

        LOGGER.success("Ready to start agenda scheduler");
        await agendaInstance.start(); // 启动调度器
    }
}

// 启动应用
bootstrapAll();
