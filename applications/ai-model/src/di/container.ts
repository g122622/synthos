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

/**
 * 初始化并注册 ReportEmailService 到 DI 容器
 * 在 ai-model 应用启动时调用
 */
function registerReportEmailService(): void {
    container.registerSingleton(AI_MODEL_TOKENS.ReportEmailService, ReportEmailService);
}

/**
 * 从 DI 容器获取 ReportEmailService 实例
 * @returns ReportEmailService 实例
 */
function getReportEmailService(): ReportEmailService {
    return container.resolve<ReportEmailService>(AI_MODEL_TOKENS.ReportEmailService);
}

/**
 * 注册 VectorDBManager 实例到 DI 容器
 * @param instance 已初始化的 VectorDBManager 实例
 */
function registerVectorDBManager(instance: VectorDBManager): void {
    container.registerInstance(AI_MODEL_TOKENS.VectorDBManager, instance);
}

/**
 * 从 DI 容器获取 VectorDBManager 实例
 * @returns VectorDBManager 实例
 */
function getVectorDBManager(): VectorDBManager {
    return container.resolve<VectorDBManager>(AI_MODEL_TOKENS.VectorDBManager);
}

/**
 * 注册 TextGeneratorService 到 DI 容器
 */
function registerTextGeneratorService(): void {
    container.registerSingleton(AI_MODEL_TOKENS.TextGeneratorService, TextGeneratorService);
}

/**
 * 从 DI 容器获取 TextGeneratorService 实例
 * @returns TextGeneratorService 实例
 */
function getTextGeneratorService(): TextGeneratorService {
    return container.resolve<TextGeneratorService>(AI_MODEL_TOKENS.TextGeneratorService);
}

/**
 * 注册 RAGCtxBuilder 到 DI 容器
 */
function registerRAGCtxBuilder(): void {
    container.registerSingleton(AI_MODEL_TOKENS.RAGCtxBuilder, RAGCtxBuilder);
}

/**
 * 从 DI 容器获取 RAGCtxBuilder 实例
 * @returns RAGCtxBuilder 实例
 */
function getRAGCtxBuilder(): RAGCtxBuilder {
    return container.resolve<RAGCtxBuilder>(AI_MODEL_TOKENS.RAGCtxBuilder);
}

/**
 * 注册 RagRPCImpl 到 DI 容器
 */
function registerRagRPCImpl(): void {
    container.registerSingleton(AI_MODEL_TOKENS.RagRPCImpl, RagRPCImpl);
}

/**
 * 从 DI 容器获取 RagRPCImpl 实例
 * @returns RagRPCImpl 实例
 */
function getRagRPCImpl(): RagRPCImpl {
    return container.resolve<RagRPCImpl>(AI_MODEL_TOKENS.RagRPCImpl);
}

/**
 * 注册所有任务处理器到 DI 容器
 */
function registerTaskHandlers(): void {
    container.registerSingleton(AI_MODEL_TOKENS.AISummarizeTaskHandler, AISummarizeTaskHandler);
    container.registerSingleton(AI_MODEL_TOKENS.InterestScoreTaskHandler, InterestScoreTaskHandler);
    container.registerSingleton(AI_MODEL_TOKENS.GenerateEmbeddingTaskHandler, GenerateEmbeddingTaskHandler);
    container.registerSingleton(AI_MODEL_TOKENS.GenerateReportTaskHandler, GenerateReportTaskHandler);
}

export async function registerAllDependencies(): Promise<void> {
    // 1. 初始化 DI 容器 - 注册基础服务
    registerConfigManagerService();
    registerCommonDBService();
    registerEmailService();
    registerReportEmailService();

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
    registerVectorDBManager(vectorDBManager);

    // 5. 注册并初始化文本生成器
    registerTextGeneratorService();
    const textGenerator = getTextGeneratorService();
    await textGenerator.init();

    // 6. 注册 RAGCtxBuilder 和 RagRPCImpl
    registerRAGCtxBuilder();
    registerRagRPCImpl();

    // 7. 注册任务处理器
    registerTaskHandlers();

    // 8. 注册各大任务到 Agenda 调度器
    const aiSummarizeTaskHandler = getAISummarizeTaskHandler();
    await aiSummarizeTaskHandler.register();

    const interestScoreTaskHandler = getInterestScoreTaskHandler();
    await interestScoreTaskHandler.register();

    const generateEmbeddingTaskHandler = getGenerateEmbeddingTaskHandler();
    await generateEmbeddingTaskHandler.register();

    const generateReportTaskHandler = getGenerateReportTaskHandler();
    await generateReportTaskHandler.register();
}
