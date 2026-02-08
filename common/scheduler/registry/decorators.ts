/**
 * 任务注册装饰器
 *
 * 用于自动注册任务到全局注册中心
 */

import { container } from "../../../common/di/container";
import { COMMON_TOKENS } from "../../di/tokens";
import { TaskRegistry } from "./TaskRegistry";
import { TaskMetadata } from "./types";

/**
 * 待注册任务队列（装饰器执行时收集）
 */
const pendingTaskMetadata: TaskMetadata[] = [];

/**
 * @registerTask 装饰器
 *
 * 用于类装饰器，收集任务元数据待后续注册
 * 实际注册由 TaskRegistry.registerPendingTasks() 完成
 *
 * 具体使用可以参考已有任务实现
 */
export function registerTask<TParams = any>(metadata: TaskMetadata<TParams>): ClassDecorator {
    return function <T extends Function>(target: T): T {
        // 收集待注册的任务元数据
        pendingTaskMetadata.push(metadata);

        return target;
    };
}

/**
 * 批量注册所有通过装饰器收集的任务
 * 应在服务启动时调用
 */
export async function registerPendingTasks(): Promise<void> {
    const taskRegistry = container.resolve<TaskRegistry>(COMMON_TOKENS.TaskRegistry);

    await taskRegistry.init();

    for (const metadata of pendingTaskMetadata) {
        try {
            await taskRegistry.registerSingleTask(metadata);
        } catch (error) {
            // 忽略重复注册错误，其他错误继续抛出
            const errorMsg = (error as Error).message;

            if (!errorMsg.includes("已被其他实例注册")) {
                throw error;
            }
        }
    }

    // 清空队列
    pendingTaskMetadata.length = 0;
}
