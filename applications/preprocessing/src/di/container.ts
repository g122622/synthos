/**
 * preprocessing 子项目的 DI 容器管理
 * 提供子项目特有服务的注册和获取函数
 */
import "reflect-metadata";
import { container } from "tsyringe";

import { PreprocessTaskHandler } from "../tasks/PreprocessTask";
import { AccumulativeSplitter } from "../splitters/AccumulativeSplitter";
import { TimeoutSplitter } from "../splitters/TimeoutSplitter";

import { PREPROCESSING_TOKENS } from "./tokens";

/**
 * 注册 AccumulativeSplitter 到 DI 容器
 */
export function registerAccumulativeSplitter(): void {
    container.register(PREPROCESSING_TOKENS.AccumulativeSplitter, { useClass: AccumulativeSplitter });
}

/**
 * 从 DI 容器获取 AccumulativeSplitter 实例
 * 每次调用返回新实例（非单例）
 * @returns AccumulativeSplitter 实例
 */
export function getAccumulativeSplitter(): AccumulativeSplitter {
    return container.resolve<AccumulativeSplitter>(PREPROCESSING_TOKENS.AccumulativeSplitter);
}

/**
 * 注册 TimeoutSplitter 到 DI 容器
 */
export function registerTimeoutSplitter(): void {
    container.register(PREPROCESSING_TOKENS.TimeoutSplitter, { useClass: TimeoutSplitter });
}

/**
 * 从 DI 容器获取 TimeoutSplitter 实例
 * 每次调用返回新实例（非单例）
 * @returns TimeoutSplitter 实例
 */
export function getTimeoutSplitter(): TimeoutSplitter {
    return container.resolve<TimeoutSplitter>(PREPROCESSING_TOKENS.TimeoutSplitter);
}

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
