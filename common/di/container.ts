/**
 * 共享的 DI 容器初始化工具
 * 提供通用的注册函数，各 app 在启动时调用
 */
import "reflect-metadata";
import { container } from "tsyringe";

import ConfigManagerService from "../services/config/ConfigManagerService";
import { EmailService } from "../services/email/EmailService";
import { RedisService } from "../services/redis/RedisService";
import { CommonDBService } from "../services/database/infra/CommonDBService";
import { AgcDbAccessService } from "../services/database/AgcDbAccessService";
import { ImDbAccessService } from "../services/database/ImDbAccessService";
import { ImDbFtsService } from "../services/database/fts/ImDbFtsService";
import { InterestScoreDbAccessService } from "../services/database/InterestScoreDbAccessService";
import { ReportDbAccessService } from "../services/database/ReportDbAccessService";
import { AgentDbAccessService } from "../services/database/AgentDbAccessService";
import { TaskRegistry } from "../scheduler/registry/TaskRegistry";

import { COMMON_TOKENS } from "./tokens";

/**
 * 初始化并注册 ConfigManagerService 到 DI 容器
 * 必须在应用启动时最先调用
 */
export function registerConfigManagerService(): void {
    container.registerInstance(COMMON_TOKENS.ConfigManagerService, ConfigManagerService);
}

/**
 * 注册 CommonDBService 到 DI 容器
 * 每次 resolve 返回新实例（非单例）
 */
export function registerCommonDBService(): void {
    container.register(COMMON_TOKENS.CommonDBService, { useClass: CommonDBService });
}

/**
 * 初始化并注册 EmailService 到 DI 容器
 * 在需要发送邮件的应用启动时调用
 */
export function registerEmailService(): void {
    container.registerSingleton(COMMON_TOKENS.EmailService, EmailService);
}

/**
 * 从 DI 容器获取 EmailService 实例
 * @returns EmailService 实例
 */
export function getEmailService(): EmailService {
    return container.resolve<EmailService>(COMMON_TOKENS.EmailService);
}

/**
 * 初始化并注册 RedisService 到 DI 容器
 * 在需要使用 Redis 的应用启动时调用
 */
export function registerRedisService(): void {
    container.registerSingleton(COMMON_TOKENS.RedisService, RedisService);
}

/**
 * 从 DI 容器获取 RedisService 实例
 * @returns RedisService 实例
 */
export function getRedisService(): RedisService {
    return container.resolve<RedisService>(COMMON_TOKENS.RedisService);
}

/**
 * 初始化并注册 TaskRegistry 到 DI 容器
 * 在需要使用任务注册中心的应用启动时调用
 */
export function registerTaskRegistry(): void {
    container.registerSingleton(COMMON_TOKENS.TaskRegistry, TaskRegistry);
}

/**
 * 从 DI 容器获取 TaskRegistry 实例
 * @returns TaskRegistry 实例
 */
export function getTaskRegistry(): TaskRegistry {
    return container.resolve<TaskRegistry>(COMMON_TOKENS.TaskRegistry);
}

/**
 * 注册 AgcDbAccessService 实例到 DI 容器
 * @param instance 已初始化的 AgcDbAccessService 实例
 */
export function registerAgcDbAccessService(instance: AgcDbAccessService): void {
    container.registerInstance(COMMON_TOKENS.AgcDbAccessService, instance);
}

/**
 * 从 DI 容器获取 AgcDbAccessService 实例
 * @returns AgcDbAccessService 实例
 */
export function getAgcDbAccessService(): AgcDbAccessService {
    return container.resolve<AgcDbAccessService>(COMMON_TOKENS.AgcDbAccessService);
}

/**
 * 注册 ImDbAccessService 实例到 DI 容器
 * @param instance 已初始化的 ImDbAccessService 实例
 */
export function registerImDbAccessService(instance: ImDbAccessService): void {
    container.registerInstance(COMMON_TOKENS.ImDbAccessService, instance);
}

/**
 * 注册 ImDbFtsService 实例到 DI 容器
 * @param instance 已初始化的 ImDbFtsService 实例
 */
export function registerImDbFtsService(instance: ImDbFtsService): void {
    container.registerInstance(COMMON_TOKENS.ImDbFtsService, instance);
}

/**
 * 从 DI 容器获取 ImDbAccessService 实例
 * @returns ImDbAccessService 实例
 */
export function getImDbAccessService(): ImDbAccessService {
    return container.resolve<ImDbAccessService>(COMMON_TOKENS.ImDbAccessService);
}

/**
 * 从 DI 容器获取 ImDbFtsService 实例
 * @returns ImDbFtsService 实例
 */
export function getImDbFtsService(): ImDbFtsService {
    return container.resolve<ImDbFtsService>(COMMON_TOKENS.ImDbFtsService);
}

/**
 * 注册 InterestScoreDbAccessService 实例到 DI 容器
 * @param instance 已初始化的 InterestScoreDbAccessService 实例
 */
export function registerInterestScoreDbAccessService(instance: InterestScoreDbAccessService): void {
    container.registerInstance(COMMON_TOKENS.InterestScoreDbAccessService, instance);
}

/**
 * 从 DI 容器获取 InterestScoreDbAccessService 实例
 * @returns InterestScoreDbAccessService 实例
 */
export function getInterestScoreDbAccessService(): InterestScoreDbAccessService {
    return container.resolve<InterestScoreDbAccessService>(COMMON_TOKENS.InterestScoreDbAccessService);
}

/**
 * 注册 ReportDbAccessService 实例到 DI 容器
 * @param instance 已初始化的 ReportDbAccessService 实例
 */
export function registerReportDbAccessService(instance: ReportDbAccessService): void {
    container.registerInstance(COMMON_TOKENS.ReportDbAccessService, instance);
}

/**
 * 从 DI 容器获取 ReportDbAccessService 实例
 * @returns ReportDbAccessService 实例
 */
export function getReportDbAccessService(): ReportDbAccessService {
    return container.resolve<ReportDbAccessService>(COMMON_TOKENS.ReportDbAccessService);
}

/**
 * 注册 AgentDbAccessService 实例到 DI 容器
 * @param instance 已初始化的 AgentDbAccessService 实例
 */
export function registerAgentDbAccessService(instance: AgentDbAccessService): void {
    container.registerInstance(COMMON_TOKENS.AgentDbAccessService, instance);
}

/**
 * 从 DI 容器获取 AgentDbAccessService 实例
 * @returns AgentDbAccessService 实例
 */
export function getAgentDbAccessService(): AgentDbAccessService {
    return container.resolve<AgentDbAccessService>(COMMON_TOKENS.AgentDbAccessService);
}

/**
 * 批量注册所有数据库服务到 DI 容器
 * @param services 包含所有已初始化数据库服务的对象
 */
export function registerDbAccessServices(services: {
    agcDbAccessService: AgcDbAccessService;
    imDbAccessService: ImDbAccessService;
    interestScoreDbAccessService: InterestScoreDbAccessService;
    reportDbAccessService: ReportDbAccessService;
    agentDbAccessService?: AgentDbAccessService;
}): void {
    registerAgcDbAccessService(services.agcDbAccessService);
    registerImDbAccessService(services.imDbAccessService);
    registerInterestScoreDbAccessService(services.interestScoreDbAccessService);
    registerReportDbAccessService(services.reportDbAccessService);
    if (services.agentDbAccessService) {
        registerAgentDbAccessService(services.agentDbAccessService);
    }
}

/**
 * 获取 tsyringe 容器实例
 */
export function getContainer() {
    return container;
}

export { container };
