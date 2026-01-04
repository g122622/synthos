import { OllamaEmbeddingService } from "../embedding/OllamaEmbeddingService";
import { startRAGRPCServer } from "./server";
import { TextGenerator } from "../generators/text/TextGenerator";
import { RAGCtxBuilder } from "../context/ctxBuilders/RAGCtxBuilder";
import { RagRPCImpl } from "../rag/RagRPCImpl";
import { VectorDBManager } from "../embedding/VectorDBManager";
import { AgcDbAccessService } from "@root/common/services/database/AgcDbAccessService";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { ReportDbAccessService } from "@root/common/services/database/ReportDbAccessService";
import { getConfigManagerService } from "@root/common/di/container";

// ========== 启动 RPC Server ==========
export const setupRPC = async (
    vectorDBManager: VectorDBManager,
    agcDbAccessService: AgcDbAccessService,
    imDbAccessService: ImDbAccessService,
    reportDbAccessService: ReportDbAccessService
) => {
    const configManagerService = getConfigManagerService();
    const config = await configManagerService.getCurrentConfig();

    // 初始化 Ollama 嵌入服务（用于 RPC 查询）
    const embeddingService = new OllamaEmbeddingService(
        config.ai.embedding.ollamaBaseURL,
        config.ai.embedding.model,
        config.ai.embedding.dimension
    );

    // 初始化 TextGenerator（用于 RAG 问答）
    const textGenerator = new TextGenerator();
    await textGenerator.init();

    // 创建 RPC 实现
    const ragCtxBuilder = new RAGCtxBuilder();
    await ragCtxBuilder.init();
    const rpcImpl = new RagRPCImpl(
        vectorDBManager,
        embeddingService,
        agcDbAccessService,
        imDbAccessService,
        reportDbAccessService,
        textGenerator,
        config.ai.defaultModelName,
        ragCtxBuilder
    );

    // 启动 RPC 服务器
    const rpcPort = config.ai.rpc?.port || 7979;
    startRAGRPCServer(rpcImpl, rpcPort);
};
