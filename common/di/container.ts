/**
 * 共享的 DI 容器初始化工具
 * 提供通用的注册函数，各 app 在启动时调用
 */
import "reflect-metadata";
import { container } from "tsyringe";
import { COMMON_TOKENS } from "./tokens";
import ConfigManagerService from "../services/config/ConfigManagerService";
import EmailServiceInstance, { EmailService } from "../services/email/EmailService";

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
 * 获取 tsyringe 容器实例
 */
export function getContainer() {
    return container;
}

export { container };
