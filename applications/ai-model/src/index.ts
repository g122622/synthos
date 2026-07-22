import "reflect-metadata";
import Logger from "@root/common/util/Logger";
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class AIModelApplication {
    /**
     * 应用主入口
     */
    public async main(): Promise<void> {
        // 1. 注册所有依赖到 DI 容器（含 5 个 task handler，供 RagRPCImpl 注入）
        await registerAllDependencies();

        // 2. 初始化 RPC 服务（暴露 RAG + AI 任务 procedure）
        await setupRPC();

        LOGGER.success("✅ AI Model 准备就绪");
    }
}

// 启动应用
bootstrapAll();
