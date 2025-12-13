import "reflect-metadata";
import { AGCDBManager } from "@root/common/database/AGCDBManager";
import { IMDBManager } from "@root/common/database/IMDBManager";
import { InterestScoreDBManager } from "@root/common/database/InterestScoreDBManager";
import Logger from "@root/common/util/Logger";
import { registerConfigManagerService, getConfigManagerService } from "@root/common/di/container";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { TaskHandlerTypes } from "@root/common/scheduler/@types/Tasks";
import { VectorDBManager } from "./embedding/VectorDBManager";
import { setupAISummarizeTask } from "./tasks/AISummarize";
import { setupInterestScoreTask } from "./tasks/InterestScore";
import { setupGenerateEmbeddingTask } from "./tasks/GenerateEmbedding";
import { setupRPC } from "./rpc/setupRPC";

(async () => {
    // 初始化 DI 容器
    registerConfigManagerService();
    const configManagerService = getConfigManagerService();
    // 初始化配置
    let config = await configManagerService.getCurrentConfig();
    // 初始化日志
    const LOGGER = Logger.withTag("🤖 ai-model-root-script");
    // 初始化数据库管理器
    const imdbManager = new IMDBManager();
    await imdbManager.init();
    const agcDBManager = new AGCDBManager();
    await agcDBManager.init();
    const interestScoreDBManager = new InterestScoreDBManager();
    await interestScoreDBManager.init();
    // 初始化向量数据库管理器
    const vectorDBManager = new VectorDBManager(
        config.ai.embedding.vectorDBPath,
        config.ai.embedding.dimension
    );
    await vectorDBManager.init();
    // 初始化 RPC 服务
    await setupRPC(vectorDBManager, agcDBManager);

    // 定义各大任务
    await setupAISummarizeTask(imdbManager, agcDBManager);
    await setupInterestScoreTask(imdbManager, agcDBManager, interestScoreDBManager);
    await setupGenerateEmbeddingTask(imdbManager, agcDBManager, vectorDBManager);

    // 调试：立即执行一次 xxx 任务
    await agendaInstance.now(TaskHandlerTypes.DecideAndDispatchGenerateEmbedding);

    LOGGER.success("Ready to start agenda scheduler");
    await agendaInstance.start(); // 👈 启动调度器
})();
