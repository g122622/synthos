/**
 * ai-model 子项目的 DI 容器管理
 * 提供子项目特有服务的注册和获取函数
 */
import "reflect-metadata";
import { container } from "tsyringe";
import { AI_MODEL_TOKENS } from "./tokens";
import { ReportEmailService } from "../services/email/ReportEmailService";
import { VectorDBManagerService } from "../services/embedding/VectorDBManagerService";
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
import { AgentDbAccessService } from "@root/common/services/database/AgentDbAccessService";
import { COMMON_TOKENS } from "@root/common/di/tokens";
import { EmbeddingService } from "../services/embedding/EmbeddingService";
import { RagSearchTool } from "../agent/tools/RagSearchTool";
import { SQLQueryTool } from "../agent/tools/SQLQueryTool";
import { WebSearchTool } from "../agent/tools/WebSearchTool";
import { AgentToolCatalog } from "../agent-langgraph/AgentToolCatalog";
import { LangGraphCheckpointerService } from "../agent-langgraph/LangGraphCheckpointerService";
import { LangGraphAgentExecutor } from "../agent-langgraph/LangGraphAgentExecutor";

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
    const agentDbAccessService = new AgentDbAccessService();
    await agentDbAccessService.init();
    // 3. 注册数据库服务到 DI 容器
    registerDbAccessServices({
        agcDbAccessService,
        imDbAccessService,
        interestScoreDbAccessService,
        reportDbAccessService,
        agentDbAccessService
    });

    // 4. 初始化向量数据库管理器和嵌入服务
    const vectorDBManagerService = new VectorDBManagerService(
        config.ai.embedding.vectorDBPath,
        config.ai.embedding.dimension
    );
    await vectorDBManagerService.init();
    container.registerInstance(AI_MODEL_TOKENS.VectorDBManagerService, vectorDBManagerService);
    const embeddingService = new EmbeddingService(
        config.ai.embedding.ollamaBaseURL,
        config.ai.embedding.model,
        config.ai.embedding.dimension
    );
    container.registerInstance(AI_MODEL_TOKENS.EmbeddingService, embeddingService);

    // 5. 注册并初始化文本生成器
    // 这里要手动解析注入一下下依赖 TODO 看看有没有更优雅的方式
    const textGenerator = new TextGeneratorService(
        container.resolve<typeof ConfigManagerService>(COMMON_TOKENS.ConfigManagerService)
    );
    await textGenerator.init();
    container.registerInstance(AI_MODEL_TOKENS.TextGeneratorService, textGenerator);

    // 6. 注册 RAGCtxBuilder 和 RagRPCImpl
    container.registerSingleton(AI_MODEL_TOKENS.RAGCtxBuilder, RAGCtxBuilder);
    container.registerSingleton(AI_MODEL_TOKENS.RagRPCImpl, RagRPCImpl);

    // 7. 注册任务处理器
    container.registerSingleton(AI_MODEL_TOKENS.AISummarizeTaskHandler, AISummarizeTaskHandler);
    container.registerSingleton(AI_MODEL_TOKENS.InterestScoreTaskHandler, InterestScoreTaskHandler);
    container.registerSingleton(AI_MODEL_TOKENS.GenerateEmbeddingTaskHandler, GenerateEmbeddingTaskHandler);
    container.registerSingleton(AI_MODEL_TOKENS.GenerateReportTaskHandler, GenerateReportTaskHandler);

    // 8. 注册 Agent 相关服务（工具实现 + LangGraph 执行器）
    container.registerSingleton(AI_MODEL_TOKENS.RagSearchTool, RagSearchTool);
    container.registerSingleton(AI_MODEL_TOKENS.SQLQueryTool, SQLQueryTool);
    container.registerSingleton(AI_MODEL_TOKENS.WebSearchTool, WebSearchTool);
    container.registerSingleton(AI_MODEL_TOKENS.AgentToolCatalog, AgentToolCatalog);
    container.registerSingleton(AI_MODEL_TOKENS.LangGraphCheckpointerService, LangGraphCheckpointerService);
    container.registerSingleton(AI_MODEL_TOKENS.LangGraphAgentExecutor, LangGraphAgentExecutor);
}
