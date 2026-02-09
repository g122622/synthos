/**
 * data-provider 子项目的 DI 容器管理
 * 提供子项目特有服务的注册和获取函数
 */
import "reflect-metadata";
import { container } from "tsyringe";

import { ProvideDataTaskHandler } from "../tasks/ProvideDataTask";
import { QQProvider } from "../providers/QQProvider/QQProvider";

import { DATA_PROVIDER_TOKENS } from "./tokens";

/**
 * 注册 QQProvider 到 DI 容器
 */
export function registerQQProvider(): void {
    container.register(DATA_PROVIDER_TOKENS.QQProvider, { useClass: QQProvider });
}

/**
 * 从 DI 容器获取 QQProvider 实例
 * 每次调用返回新实例（非单例）
 * @returns QQProvider 实例
 */
export function getQQProvider(): QQProvider {
    return container.resolve<QQProvider>(DATA_PROVIDER_TOKENS.QQProvider);
}

/**
 * 注册任务处理器到 DI 容器
 */
export function registerTaskHandlers(): void {
    container.registerSingleton(DATA_PROVIDER_TOKENS.ProvideDataTaskHandler, ProvideDataTaskHandler);
}

/**
 * 获取容器实例
 */
export function getContainer() {
    return container;
}

export { container };
