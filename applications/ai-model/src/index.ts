import "reflect-metadata";
import { AgcDbAccessService } from "@root/common/services/database/AgcDbAccessService";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { InterestScoreDbAccessService } from "@root/common/services/database/InterestScoreDbAccessService";
import { ReportDbAccessService } from "@root/common/services/database/ReportDbAccessService";
import Logger from "@root/common/util/Logger";
import {
    registerConfigManagerService,
    getConfigManagerService,
    registerEmailService,
    registerDbAccessServices
} from "@root/common/di/container";
import {
    registerReportEmailService,
    registerVectorDBManager,
    registerTextGenerator,
    registerRAGCtxBuilder,
    registerRagRPCImpl,
    registerTaskHandlers,
    getAISummarizeTaskHandler,
    getInterestScoreTaskHandler,
    getGenerateEmbeddingTaskHandler,
    getGenerateReportTaskHandler
} from "./di/container";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { bootstrap, bootstrapAll } from "@root/common/util/lifecycle/bootstrap";
import { VectorDBManager } from "./embedding/VectorDBManager";
import { TextGenerator } from "./generators/text/TextGenerator";
import { setupRPC } from "./rpc/setupRPC";

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
        // 1. 初始化 DI 容器 - 注册基础服务
        registerConfigManagerService();
        registerEmailService();
        registerReportEmailService();

        const configManagerService = getConfigManagerService();
        const config = await configManagerService.getCurrentConfig();

        // 2. 初始化数据库管理器
        const imDbAccessService = new ImDbAccessService();
        await imDbAccessService.init();
        const agcDbAccessService = new AgcDbAccessService();
        await agcDbAccessService.init();
        const interestScoreDbAccessService = new InterestScoreDbAccessService();
        await interestScoreDbAccessService.init();
        const reportDbAccessService = new ReportDbAccessService();
        await reportDbAccessService.init();

        // 3. 注册数据库服务到 DI 容器
        registerDbAccessServices({
            agcDbAccessService,
            imDbAccessService,
            interestScoreDbAccessService,
            reportDbAccessService
        });

        // 4. 初始化向量数据库管理器并注册
        const vectorDBManager = new VectorDBManager(
            config.ai.embedding.vectorDBPath,
            config.ai.embedding.dimension
        );
        await vectorDBManager.init();
        registerVectorDBManager(vectorDBManager);

        // 5. 初始化文本生成器并注册
        const textGenerator = new TextGenerator();
        await textGenerator.init();
        registerTextGenerator(textGenerator);

        // 6. 注册 RAGCtxBuilder 和 RagRPCImpl
        registerRAGCtxBuilder();
        registerRagRPCImpl();

        // 7. 注册任务处理器
        registerTaskHandlers();

        // 8. 初始化 RPC 服务
        await setupRPC();

        // 9. 注册各大任务到 Agenda 调度器
        const aiSummarizeTaskHandler = getAISummarizeTaskHandler();
        await aiSummarizeTaskHandler.register();

        const interestScoreTaskHandler = getInterestScoreTaskHandler();
        await interestScoreTaskHandler.register();

        const generateEmbeddingTaskHandler = getGenerateEmbeddingTaskHandler();
        await generateEmbeddingTaskHandler.register();

        const generateReportTaskHandler = getGenerateReportTaskHandler();
        await generateReportTaskHandler.register();

        LOGGER.success("Ready to start agenda scheduler");
        await agendaInstance.start(); // 启动调度器
    }
}

// 启动应用
bootstrapAll();
