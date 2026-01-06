/**
 * data-provider 子项目的 DI 容器管理
 * 提供子项目特有服务的注册和获取函数
 */
import "reflect-metadata";
import { container } from "tsyringe";
import { DATA_PROVIDER_TOKENS } from "./tokens";
import { ProvideDataTaskHandler } from "../tasks/ProvideDataTask";

/**
 * 注册任务处理器到 DI 容器
 */
export function registerTaskHandlers(): void {
    container.registerSingleton(DATA_PROVIDER_TOKENS.ProvideDataTaskHandler, ProvideDataTaskHandler);
}

/**
 * 从 DI 容器获取 ProvideDataTaskHandler 实例
 * @returns ProvideDataTaskHandler 实例
 */
export function getProvideDataTaskHandler(): ProvideDataTaskHandler {
    return container.resolve<ProvideDataTaskHandler>(DATA_PROVIDER_TOKENS.ProvideDataTaskHandler);
}

/**
 * 获取容器实例
 */
export function getContainer() {
    return container;
}

export { container };
