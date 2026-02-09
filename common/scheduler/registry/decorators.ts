/**
 * 任务注册装饰器
 *
 * 用于自动注册任务到全局注册中心
 */

import { getContainer, getEventService, getTaskRegistry } from "../../../common/di/container";
import { EventChannels } from "../../services/event/contracts/channels";
import Logger from "../../util/Logger";

import { TaskDispatchContext, TaskMetadata } from "./types";

const LOGGER = Logger.withTag("📋 TaskRegistry");

const pendingTaskHandlerTypes: Map<string, new (...args: any[]) => any> = new Map();
const pendingTaskMetadatas: Map<string, TaskMetadata<any>> = new Map();

let isTaskDispatchSubscribed = false;

/**
 * @registerTask 装饰器
 *
 * 用于类装饰器，注册任务元数据和任务处理器实例
 *
 * 具体使用可以参考已有任务实现
 */
export function registerTask<TParams = any>(metadata: TaskMetadata<TParams>): ClassDecorator {
    return function <T extends Function>(target: T): T {
        // 仅收集待注册的任务元数据与处理器类型。
        // 注意：不要在装饰器执行阶段访问 EventService/TaskRegistry 的方法。
        // 因为它们通常在应用启动后才会 init()，且会被 mustInitBeforeUse 保护。
        pendingTaskMetadatas.set(metadata.internalName, metadata as TaskMetadata<any>);

        // 收集任务处理器类型（不要在此处 new，否则依赖注入会失效）
        pendingTaskHandlerTypes.set(metadata.internalName, target as any);

        return target;
    };
}

/**
 * 激活所有通过 @registerTask 收集到的任务。
 *
 * 调用方必须确保：
 * 1) 已完成依赖注入注册（尤其是 ConfigManagerService、RedisService、EventService、TaskRegistry）。
 * 2) 已执行 await getEventService().init()（否则 subscribe/publish 会抛错）。
 */
export async function activateTaskHandlers(): Promise<void> {
    // 1) 注册任务元数据到 TaskRegistry（含 schema 与 defaultParams）
    const taskRegistry = getTaskRegistry();

    await taskRegistry.init();

    for (const metadata of pendingTaskMetadatas.values()) {
        try {
            await taskRegistry.registerSingleTask(metadata);
        } catch (error) {
            LOGGER.error(`注册任务元数据失败: ${metadata.internalName}, error=${error}`);
            throw error;
        }
    }

    // 2) 订阅调度事件（全局只订阅一次）
    if (isTaskDispatchSubscribed) {
        return;
    }

    const eventService = getEventService();

    await eventService.subscribe<TaskDispatchContext>(EventChannels.DispatchTask, async data => {
        const internalName = data.metadata.internalName;
        const handlerType = pendingTaskHandlerTypes.get(internalName);

        if (!handlerType) {
            throw new Error(`未找到任务处理器类型: ${internalName}`);
        }

        const handlerInstance = getContainer().resolve<any>(handlerType as any);

        if (!handlerInstance || typeof handlerInstance.run !== "function") {
            throw new Error(`任务处理器 [${internalName}] 未实现 run(params) 方法`);
        }

        LOGGER.info(`😋开始处理任务: ${internalName} ( ${data.metadata.displayName} )`);
        await handlerInstance.run(data.params);
        LOGGER.success(`🥳任务完成: ${internalName} ( ${data.metadata.displayName} )`);

        await eventService.publish(EventChannels.CompleteTask, {
            metadata: data.metadata
        });
    });

    isTaskDispatchSubscribed = true;
}
