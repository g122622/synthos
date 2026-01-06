/**
 * preprocessing 子项目的 DI 容器管理
 * 提供子项目特有服务的注册和获取函数
 */
import "reflect-metadata";
import { container } from "tsyringe";
import { PREPROCESSING_TOKENS } from "./tokens";
import { PreprocessTaskHandler } from "../tasks/PreprocessTask";

/**
 * 注册任务处理器到 DI 容器
 */
export function registerTaskHandlers(): void {
    container.registerSingleton(PREPROCESSING_TOKENS.PreprocessTaskHandler, PreprocessTaskHandler);
}

/**
 * 从 DI 容器获取 PreprocessTaskHandler 实例
 * @returns PreprocessTaskHandler 实例
 */
export function getPreprocessTaskHandler(): PreprocessTaskHandler {
    return container.resolve<PreprocessTaskHandler>(PREPROCESSING_TOKENS.PreprocessTaskHandler);
}

/**
 * 获取容器实例
 */
export function getContainer() {
    return container;
}

export { container };
