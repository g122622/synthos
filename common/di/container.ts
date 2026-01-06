/**
 * 共享的 DI 容器初始化工具
 * 提供通用的注册函数，各 app 在启动时调用
 */
import "reflect-metadata";
import { container } from "tsyringe";
import { COMMON_TOKENS } from "./tokens";
import ConfigManagerService from "../services/config/ConfigManagerService";
import EmailServiceInstance, { EmailService } from "../services/email/EmailService";
import { AgcDbAccessService } from "../services/database/AgcDbAccessService";
import { ImDbAccessService } from "../services/database/ImDbAccessService";
import { InterestScoreDbAccessService } from "../services/database/InterestScoreDbAccessService";
import { ReportDbAccessService } from "../services/database/ReportDbAccessService";

/**
 * 初始化并注册 ConfigManagerService 到 DI 容器
 * 必须在应用启动时最先调用
 */
export function registerConfigManagerService(): void {
    container.registerInstance(COMMON_TOKENS.ConfigManagerService, ConfigManagerService);
}

/**
 * 从 DI 容器获取 ConfigManagerService 实例
 * 优先从 DI 容器获取，如果容器未初始化则回退到默认单例
 */
export function getConfigManagerService(): typeof ConfigManagerService {
    try {
        return container.resolve<typeof ConfigManagerService>(COMMON_TOKENS.ConfigManagerService);
    } catch {
        // DI 容器未初始化，回退到默认单例
        return ConfigManagerService;
    }
}

/**
 * 初始化并注册 EmailService 到 DI 容器
 * 在需要发送邮件的应用启动时调用
 */
export function registerEmailService(): void {
    container.registerInstance(COMMON_TOKENS.EmailService, EmailServiceInstance);
}

/**
 * 从 DI 容器获取 EmailService 实例
 * @returns EmailService 实例
 */
export function getEmailService(): EmailService {
    return container.resolve<EmailService>(COMMON_TOKENS.EmailService);
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
 * 从 DI 容器获取 ImDbAccessService 实例
 * @returns ImDbAccessService 实例
 */
export function getImDbAccessService(): ImDbAccessService {
    return container.resolve<ImDbAccessService>(COMMON_TOKENS.ImDbAccessService);
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
 * 批量注册所有数据库服务到 DI 容器
 * @param services 包含所有已初始化数据库服务的对象
 */
export function registerDbAccessServices(services: {
    agcDbAccessService: AgcDbAccessService;
    imDbAccessService: ImDbAccessService;
    interestScoreDbAccessService: InterestScoreDbAccessService;
    reportDbAccessService: ReportDbAccessService;
}): void {
    registerAgcDbAccessService(services.agcDbAccessService);
    registerImDbAccessService(services.imDbAccessService);
    registerInterestScoreDbAccessService(services.interestScoreDbAccessService);
    registerReportDbAccessService(services.reportDbAccessService);
}

/**
 * 获取 tsyringe 容器实例
 */
export function getContainer() {
    return container;
}

export { container };
