import "reflect-metadata";
import { AGCDBManager } from "@root/common/database/AGCDBManager";
import { IMDBManager } from "@root/common/database/IMDBManager";
import { InterestScoreDBManager } from "@root/common/database/InterestScoreDBManager";
import { ReportDBManager } from "@root/common/database/ReportDBManager";
import Logger from "@root/common/util/Logger";
import { registerConfigManagerService, getConfigManagerService } from "@root/common/di/container";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { bootstrap, bootstrapAll } from "@root/common/util/lifecycle/bootstrap";
import { VectorDBManager } from "./embedding/VectorDBManager";
import { setupAISummarizeTask } from "./tasks/AISummarize";
import { setupInterestScoreTask } from "./tasks/InterestScore";
import { setupGenerateEmbeddingTask } from "./tasks/GenerateEmbedding";
import { setupGenerateReportTask } from "./tasks/GenerateReport";
import { setupRPC } from "./rpc/setupRPC";

const LOGGER = Logger.withTag("🤖 ai-model-root-script");

@bootstrap
class AIModelApplication {
    public async main(): Promise<void> {
        // 初始化 DI 容器
        registerConfigManagerService();
        const configManagerService = getConfigManagerService();
        // 初始化配置
        const config = await configManagerService.getCurrentConfig();
        // 初始化数据库管理器
        const imdbManager = new IMDBManager();
        await imdbManager.init();
        const agcDBManager = new AGCDBManager();
        await agcDBManager.init();
        const interestScoreDBManager = new InterestScoreDBManager();
        await interestScoreDBManager.init();
        const reportDBManager = new ReportDBManager();
        await reportDBManager.init();
        // 初始化向量数据库管理器
        const vectorDBManager = new VectorDBManager(
            config.ai.embedding.vectorDBPath,
            config.ai.embedding.dimension
        );
        await vectorDBManager.init();
        // 初始化 RPC 服务
        await setupRPC(vectorDBManager, agcDBManager, imdbManager);

        // 定义各大任务（由 orchestrator 统一调度，此处只注册任务处理器）
        await setupAISummarizeTask(imdbManager, agcDBManager);
        await setupInterestScoreTask(imdbManager, agcDBManager, interestScoreDBManager);
        await setupGenerateEmbeddingTask(imdbManager, agcDBManager, vectorDBManager);
        await setupGenerateReportTask(agcDBManager, reportDBManager, interestScoreDBManager);

        LOGGER.success("Ready to start agenda scheduler");
        await agendaInstance.start(); // 启动调度器
    }
}

// 启动应用
bootstrapAll();
