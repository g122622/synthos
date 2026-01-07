/**
 * ai-model 子项目的 DI 容器管理
 * 提供子项目特有服务的注册和获取函数
 */
import "reflect-metadata";
import { container } from "tsyringe";
import { AI_MODEL_TOKENS } from "./tokens";
import { ReportEmailService } from "../services/email/ReportEmailService";
import { VectorDBManager } from "../embedding/VectorDBManager";
import { TextGenerator } from "../generators/text/TextGenerator";
import { RAGCtxBuilder } from "../context/ctxBuilders/RAGCtxBuilder";
import { RagRPCImpl } from "../rag/RagRPCImpl";
import { AISummarizeTaskHandler } from "../tasks/AISummarize";
import { InterestScoreTaskHandler } from "../tasks/InterestScore";
import { GenerateEmbeddingTaskHandler } from "../tasks/GenerateEmbedding";
import { GenerateReportTaskHandler } from "../tasks/GenerateReport";

/**
 * 初始化并注册 ReportEmailService 到 DI 容器
 * 在 ai-model 应用启动时调用
 */
export function registerReportEmailService(): void {
    container.registerSingleton(AI_MODEL_TOKENS.ReportEmailService, ReportEmailService);
}

/**
 * 从 DI 容器获取 ReportEmailService 实例
 * @returns ReportEmailService 实例
 */
export function getReportEmailService(): ReportEmailService {
    return container.resolve<ReportEmailService>(AI_MODEL_TOKENS.ReportEmailService);
}

/**
 * 注册 VectorDBManager 实例到 DI 容器
 * @param instance 已初始化的 VectorDBManager 实例
 */
export function registerVectorDBManager(instance: VectorDBManager): void {
    container.registerInstance(AI_MODEL_TOKENS.VectorDBManager, instance);
}

/**
 * 从 DI 容器获取 VectorDBManager 实例
 * @returns VectorDBManager 实例
 */
export function getVectorDBManager(): VectorDBManager {
    return container.resolve<VectorDBManager>(AI_MODEL_TOKENS.VectorDBManager);
}

/**
 * 注册 TextGenerator 到 DI 容器
 */
export function registerTextGenerator(): void {
    container.registerSingleton(AI_MODEL_TOKENS.TextGenerator, TextGenerator);
}

/**
 * 从 DI 容器获取 TextGenerator 实例
 * @returns TextGenerator 实例
 */
export function getTextGenerator(): TextGenerator {
    return container.resolve<TextGenerator>(AI_MODEL_TOKENS.TextGenerator);
}

/**
 * 注册 RAGCtxBuilder 到 DI 容器
 */
export function registerRAGCtxBuilder(): void {
    container.registerSingleton(AI_MODEL_TOKENS.RAGCtxBuilder, RAGCtxBuilder);
}

/**
 * 从 DI 容器获取 RAGCtxBuilder 实例
 * @returns RAGCtxBuilder 实例
 */
export function getRAGCtxBuilder(): RAGCtxBuilder {
    return container.resolve<RAGCtxBuilder>(AI_MODEL_TOKENS.RAGCtxBuilder);
}

/**
 * 注册 RagRPCImpl 到 DI 容器
 */
export function registerRagRPCImpl(): void {
    container.registerSingleton(AI_MODEL_TOKENS.RagRPCImpl, RagRPCImpl);
}

/**
 * 从 DI 容器获取 RagRPCImpl 实例
 * @returns RagRPCImpl 实例
 */
export function getRagRPCImpl(): RagRPCImpl {
    return container.resolve<RagRPCImpl>(AI_MODEL_TOKENS.RagRPCImpl);
}

/**
 * 注册所有任务处理器到 DI 容器
 */
export function registerTaskHandlers(): void {
    container.registerSingleton(AI_MODEL_TOKENS.AISummarizeTaskHandler, AISummarizeTaskHandler);
    container.registerSingleton(AI_MODEL_TOKENS.InterestScoreTaskHandler, InterestScoreTaskHandler);
    container.registerSingleton(AI_MODEL_TOKENS.GenerateEmbeddingTaskHandler, GenerateEmbeddingTaskHandler);
    container.registerSingleton(AI_MODEL_TOKENS.GenerateReportTaskHandler, GenerateReportTaskHandler);
}

/**
 * 从 DI 容器获取 AISummarizeTaskHandler 实例
 * @returns AISummarizeTaskHandler 实例
 */
export function getAISummarizeTaskHandler(): AISummarizeTaskHandler {
    return container.resolve<AISummarizeTaskHandler>(AI_MODEL_TOKENS.AISummarizeTaskHandler);
}

/**
 * 从 DI 容器获取 InterestScoreTaskHandler 实例
 * @returns InterestScoreTaskHandler 实例
 */
export function getInterestScoreTaskHandler(): InterestScoreTaskHandler {
    return container.resolve<InterestScoreTaskHandler>(AI_MODEL_TOKENS.InterestScoreTaskHandler);
}

/**
 * 从 DI 容器获取 GenerateEmbeddingTaskHandler 实例
 * @returns GenerateEmbeddingTaskHandler 实例
 */
export function getGenerateEmbeddingTaskHandler(): GenerateEmbeddingTaskHandler {
    return container.resolve<GenerateEmbeddingTaskHandler>(AI_MODEL_TOKENS.GenerateEmbeddingTaskHandler);
}

/**
 * 从 DI 容器获取 GenerateReportTaskHandler 实例
 * @returns GenerateReportTaskHandler 实例
 */
export function getGenerateReportTaskHandler(): GenerateReportTaskHandler {
    return container.resolve<GenerateReportTaskHandler>(AI_MODEL_TOKENS.GenerateReportTaskHandler);
}

/**
 * 获取容器实例
 */
export function getContainer() {
    return container;
}

export { container };
