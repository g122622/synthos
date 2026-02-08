/**
 * 依赖注入容器配置
 */
import "reflect-metadata";
import { container } from "tsyringe";
import {
    registerConfigManagerService,
    registerCommonDBService,
    registerEmailService,
    registerDbAccessServices,
    registerRedisService as registerCommonRedisService,
    registerTaskRegistry as registerCommonTaskRegistry
} from "@root/common/di/container";
import { AgcDbAccessService } from "@root/common/services/database/AgcDbAccessService";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { InterestScoreDbAccessService } from "@root/common/services/database/InterestScoreDbAccessService";
import { ReportDbAccessService } from "@root/common/services/database/ReportDbAccessService";

import { TopicFavoriteStatusManager } from "../repositories/TopicFavoriteStatusManager";
import { TopicReadStatusManager } from "../repositories/TopicReadStatusManager";
import { RagChatHistoryManager } from "../repositories/RagChatHistoryManager";
import { ReportReadStatusManager } from "../repositories/ReportReadStatusManager";
import { AIDigestService } from "../services/AIDigestService";
import { ChatMessageService } from "../services/ChatMessageService";
import { ChatMessageFtsService } from "../services/ChatMessageFtsService";
import { GroupConfigService } from "../services/GroupConfigService";
import { InterestScoreService } from "../services/InterestScoreService";
import { MiscService } from "../services/MiscService";
import { TopicStatusService } from "../services/TopicStatusService";
import { SearchService } from "../services/SearchService";
import { ConfigService } from "../services/ConfigService";
import { RagChatHistoryService } from "../services/RagChatHistoryService";
import { ReportService } from "../services/ReportService";
import { SystemMonitorService } from "../services/SystemMonitorService";
import { AgentService } from "../services/AgentService";
import { LogsService } from "../services/LogsService";
import { createRAGClient } from "../rpc/aiModelClient";
import { createOrchestratorClient } from "../rpc/orchestratorClient";
import { AIDigestController } from "../controllers/AIDigestController";
import { ChatMessageController } from "../controllers/ChatMessageController";
import { ChatMessageFtsController } from "../controllers/ChatMessageFtsController";
import { GroupConfigController } from "../controllers/GroupConfigController";
import { InterestScoreController } from "../controllers/InterestScoreController";
import { MiscController } from "../controllers/MiscController";
import { TopicStatusController } from "../controllers/TopicStatusController";
import { SearchController } from "../controllers/SearchController";
import { ConfigController } from "../controllers/ConfigController";
import { RagChatHistoryController } from "../controllers/RagChatHistoryController";
import { ReportController } from "../controllers/ReportController";
import { SystemMonitorController } from "../controllers/SystemMonitorController";
import { AgentController } from "../controllers/AgentController";
import { LogsController } from "../controllers/LogsController";
import { WorkflowController } from "../controllers/WorkflowController";

import { TOKENS } from "./tokens";

/**
 * 注册所有 DBManager 实例
 * 使用公共的 registerDbAccessServices 函数进行注册
 */
export function registerDBManagers(
    agcDbAccessService: AgcDbAccessService,
    imDbAccessService: ImDbAccessService,
    interestScoreDbAccessService: InterestScoreDbAccessService,
    reportDbAccessService: ReportDbAccessService
): void {
    registerDbAccessServices({
        agcDbAccessService,
        imDbAccessService,
        interestScoreDbAccessService,
        reportDbAccessService
    });
}

/**
 * 注册 Status Managers
 */
export function registerStatusManagers(
    favoriteStatusManager: TopicFavoriteStatusManager,
    readStatusManager: TopicReadStatusManager,
    reportReadStatusManager: ReportReadStatusManager
): void {
    container.registerInstance(TOKENS.TopicFavoriteStatusManager, favoriteStatusManager);
    container.registerInstance(TOKENS.TopicReadStatusManager, readStatusManager);
    container.registerInstance(TOKENS.ReportReadStatusManager, reportReadStatusManager);
}

/**
 * 注册 RAG 聊天历史管理器
 */
export function registerRagChatHistoryManager(ragChatHistoryManager: RagChatHistoryManager): void {
    container.registerInstance(TOKENS.RagChatHistoryManager, ragChatHistoryManager);
}

/**
 * 注册 RAG RPC 客户端
 * @param rpcBaseUrl RAG RPC 服务地址
 */
export function registerRAGClient(rpcBaseUrl: string): void {
    const client = createRAGClient(rpcBaseUrl);

    container.registerInstance(TOKENS.RAGClient, client);
}

/**
 * 注册 Orchestrator RPC 客户端
 * @param rpcBaseUrl Orchestrator RPC 服务地址
 */
export function registerOrchestratorClient(rpcBaseUrl: string): void {
    const client = createOrchestratorClient(rpcBaseUrl);

    container.registerInstance(TOKENS.OrchestratorClient, client);
}

/**
 * 注册所有 Services
 */
export function registerServices(): void {
    container.registerSingleton(TOKENS.AIDigestService, AIDigestService);
    container.registerSingleton(TOKENS.ChatMessageService, ChatMessageService);
    container.registerSingleton(TOKENS.ChatMessageFtsService, ChatMessageFtsService);
    container.registerSingleton(TOKENS.GroupConfigService, GroupConfigService);
    container.registerSingleton(TOKENS.InterestScoreService, InterestScoreService);
    container.registerSingleton(TOKENS.MiscService, MiscService);
    container.registerSingleton(TOKENS.TopicStatusService, TopicStatusService);
    container.registerSingleton(TOKENS.SearchService, SearchService);
    container.registerSingleton(TOKENS.ConfigService, ConfigService);
    container.registerSingleton(TOKENS.RagChatHistoryService, RagChatHistoryService);
    container.registerSingleton(TOKENS.ReportService, ReportService);
    container.registerSingleton(TOKENS.SystemMonitorService, SystemMonitorService);
    container.registerSingleton(TOKENS.AgentService, AgentService);
    container.registerSingleton(TOKENS.LogsService, LogsService);
    // EmailService 现在从 common 注册
    registerEmailService();
}

/**
 * 注册所有 Controllers
 */
export function registerControllers(): void {
    container.registerSingleton(TOKENS.AIDigestController, AIDigestController);
    container.registerSingleton(TOKENS.ChatMessageController, ChatMessageController);
    container.registerSingleton(TOKENS.ChatMessageFtsController, ChatMessageFtsController);
    container.registerSingleton(TOKENS.GroupConfigController, GroupConfigController);
    container.registerSingleton(TOKENS.InterestScoreController, InterestScoreController);
    container.registerSingleton(TOKENS.MiscController, MiscController);
    container.registerSingleton(TOKENS.TopicStatusController, TopicStatusController);
    container.registerSingleton(TOKENS.SearchController, SearchController);
    container.registerSingleton(TOKENS.ConfigController, ConfigController);
    container.registerSingleton(TOKENS.RagChatHistoryController, RagChatHistoryController);
    container.registerSingleton(TOKENS.ReportController, ReportController);
    container.registerSingleton(TOKENS.SystemMonitorController, SystemMonitorController);
    container.registerSingleton(TOKENS.AgentController, AgentController);
    container.registerSingleton(TOKENS.LogsController, LogsController);
    container.registerSingleton(TOKENS.WorkflowController, WorkflowController);
}

/**
 * 注册配置面板模式所需的依赖（轻量级模式）
 * 仅注册 ConfigService 和 ConfigController
 */
export function registerConfigPanelDependencies(): void {
    container.registerSingleton(TOKENS.ConfigService, ConfigService);
    container.registerSingleton(TOKENS.ConfigController, ConfigController);
}

/**
 * 获取容器实例
 */
export function getContainer() {
    return container;
}

/**
 * 注册 Redis 服务
 */
export function registerRedisService(): void {
    registerCommonRedisService();
}

/**
 * 注册任务注册中心
 */
export function registerTaskRegistry(): void {
    registerCommonTaskRegistry();
}

export { container, registerConfigManagerService, registerCommonDBService };
