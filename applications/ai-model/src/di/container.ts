/**
 * ai-model 子项目的 DI 容器管理
 * 提供子项目特有服务的注册和获取函数
 */
import "reflect-metadata";
import { container } from "tsyringe";
import { AI_MODEL_TOKENS } from "./tokens";
import { ReportEmailService } from "../services/email/ReportEmailService";
import { VectorDBManager } from "../services/embedding/VectorDBManagerService";
import { TextGeneratorService } from "../services/generators/text/TextGeneratorService";
import { RAGCtxBuilder } from "../context/ctxBuilders/RAGCtxBuilder";
import { RagRPCImpl } from "../rag/RagRPCImpl";
import { AISummarizeTaskHandler } from "../tasks/AISummarize";
import { InterestScoreTaskHandler } from "../tasks/InterestScore";
import { GenerateEmbeddingTaskHandler } from "../tasks/GenerateEmbedding";
import { GenerateReportTaskHandler } from "../tasks/GenerateReport";
import {
    registerCommonDBService,
    registerConfigManagerService,
    registerDbAccessServices,
    registerEmailService
} from "@root/common/di/container";
import ConfigManagerService from "@root/common/services/config/ConfigManagerService";
import { AgcDbAccessService } from "@root/common/services/database/AgcDbAccessService";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { InterestScoreDbAccessService } from "@root/common/services/database/InterestScoreDbAccessService";
import { ReportDbAccessService } from "@root/common/services/database/ReportDbAccessService";

export async function registerAllDependencies(): Promise<void> {
    // 1. 初始化 DI 容器 - 注册基础服务
    registerConfigManagerService();
    registerCommonDBService();
    registerEmailService();
    container.registerSingleton(AI_MODEL_TOKENS.ReportEmailService, ReportEmailService);

    const config = await ConfigManagerService.getCurrentConfig();

    // 2. 初始化数据库服务
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
    const vectorDBManager = new VectorDBManager(config.ai.embedding.vectorDBPath, config.ai.embedding.dimension);
    await vectorDBManager.init();
    container.registerInstance(AI_MODEL_TOKENS.VectorDBManager, vectorDBManager);

    // 5. 注册并初始化文本生成器
    container.registerSingleton(AI_MODEL_TOKENS.TextGeneratorService, TextGeneratorService);
    const textGenerator = container.resolve<TextGeneratorService>(AI_MODEL_TOKENS.TextGeneratorService);
    await textGenerator.init();

    // 6. 注册 RAGCtxBuilder 和 RagRPCImpl
    container.registerSingleton(AI_MODEL_TOKENS.RAGCtxBuilder, RAGCtxBuilder);
    container.registerSingleton(AI_MODEL_TOKENS.RagRPCImpl, RagRPCImpl);

    // 7. 注册任务处理器
    container.registerSingleton(AI_MODEL_TOKENS.AISummarizeTaskHandler, AISummarizeTaskHandler);
    container.registerSingleton(AI_MODEL_TOKENS.InterestScoreTaskHandler, InterestScoreTaskHandler);
    container.registerSingleton(AI_MODEL_TOKENS.GenerateEmbeddingTaskHandler, GenerateEmbeddingTaskHandler);
    container.registerSingleton(AI_MODEL_TOKENS.GenerateReportTaskHandler, GenerateReportTaskHandler);
}
