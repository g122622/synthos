import "reflect-metadata";
import { AgcDbAccessService} from "@root/common/services/database/AgcDbAccessService";
import { ImDbAccessService} from "@root/common/services/database/ImDbAccessService";
import { InterestScoreDbAccessService } from "@root/common/services/database/InterestScoreDbAccessService";
import { ReportDbAccessService} from "@root/common/services/database/ReportDbAccessService";
import Logger from "@root/common/util/Logger";
import { registerConfigManagerService, getConfigManagerService, registerEmailService } from "@root/common/di/container";
import { registerReportEmailService } from "./di/container";
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
        registerEmailService();
        registerReportEmailService();
        const configManagerService = getConfigManagerService();
        // 初始化配置
        const config = await configManagerService.getCurrentConfig();
        // 初始化数据库管理器
        const imdbManager = new ImDbAccessService();
        await imdbManager.init();
        const agcDbAccessService = new AgcDbAccessService();
        await agcDbAccessService.init();
        const interestScoreDbAccessService = new InterestScoreDbAccessService();
        await interestScoreDbAccessService.init();
        const reportDbAccessService = new ReportDbAccessService();
        await reportDbAccessService.init();
        // 初始化向量数据库管理器
        const vectorDBManager = new VectorDBManager(
            config.ai.embedding.vectorDBPath,
            config.ai.embedding.dimension
        );
        await vectorDBManager.init();
        // 初始化 RPC 服务
        await setupRPC(vectorDBManager, agcDbAccessService, imdbManager, reportDbAccessService);

        // 定义各大任务（由 orchestrator 统一调度，此处只注册任务处理器）
        await setupAISummarizeTask(imdbManager, agcDbAccessService);
        await setupInterestScoreTask(imdbManager, agcDbAccessService, interestScoreDbAccessService);
        await setupGenerateEmbeddingTask(imdbManager, agcDbAccessService, vectorDBManager);
        await setupGenerateReportTask(agcDbAccessService, reportDbAccessService, interestScoreDbAccessService);

        LOGGER.success("Ready to start agenda scheduler");
        await agendaInstance.start(); // 启动调度器
    }
}

// 启动应用
bootstrapAll();
