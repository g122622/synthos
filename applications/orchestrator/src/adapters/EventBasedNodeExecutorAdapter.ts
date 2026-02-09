import { NodeExecutionResult } from "@root/common/contracts/workflow/index";
import Logger from "@root/common/util/Logger";
import { getEventService, getTaskRegistry } from "@root/common/di/container";
import { TaskDispatchContext, TaskMetadata } from "@root/common/scheduler/registry/types";
import { EventChannels } from "@root/common/services/event/contracts/channels";
import { ExecutionContext } from "@root/common/scheduler/helpers/ExecutionContext";

import { TaskParamsResolver } from "../core/TaskParamsResolver";

import { INodeExecutorAdapter } from "./INodeExecutorAdapter";

/**
 * 事件驱动节点执行器适配器
 * 将工作流节点的执行请求转换为事件驱动的任务调度
 */
export class EventBasedNodeExecutorAdapter implements INodeExecutorAdapter {
    private readonly LOGGER = Logger.withTag("🔌 EventBasedNodeExecutorAdapter");
    private readonly _taskTimeoutMs: number;
    private readonly _paramsResolver: TaskParamsResolver;

    /**
     * 构造函数
     * @param taskTimeoutMs 任务超时时间（毫秒）
     * @param paramsResolver 任务参数解析器
     */
    public constructor(taskTimeoutMs: number = 90 * 60 * 1000, paramsResolver: TaskParamsResolver) {
        this._taskTimeoutMs = taskTimeoutMs;
        this._paramsResolver = paramsResolver;
    }

    /**
     * 立即调度一个任务并等待其完成
     * TODO 内存泄露风险需要评估
     *
     * @param taskName - 任务名称
     * @param data - 任务参数
     * @param timeoutMs - 超时时间（毫秒）
     * @returns Promise<boolean> - 任务成功完成返回 true，超时或失败返回 false
     */
    private _scheduleAndWaitForJob(
        taskName: string,
        params: Record<string, any>,
        timeoutMs: number
    ): Promise<boolean> {
        let isResolved = false;

        return new Promise<boolean>(resolve => {
            this.LOGGER.info(`开始调度任务 [${taskName}]`);
            getTaskRegistry()
                .getRegisteredTaskByName(taskName)
                .then(metadata => {
                    if (!metadata) {
                        this.LOGGER.error(`任务类型 [${taskName}] 未注册！`);
                        throw new Error(`任务类型 [${taskName}] 未注册`);
                    }
                    // 调度任务
                    getEventService().publish<TaskDispatchContext>(EventChannels.DispatchTask, {
                        metadata,
                        params
                    });
                    // 等待任务完成
                    getEventService().subscribe<TaskMetadata>(EventChannels.CompleteTask, metadata => {
                        if (metadata.internalName === taskName && !isResolved) {
                            this.LOGGER.info(`任务 [${taskName}] 已完成`);
                            isResolved = true;
                            resolve(true);
                        }
                    });
                });
            // 设置超时处理
            setTimeout(() => {
                this.LOGGER.error(`任务 [${taskName}] 超时未完成`);
                if (!isResolved) {
                    isResolved = true;
                    resolve(false);
                }
            }, timeoutMs);
        });
    }

    /**
     * 执行任务节点
     * @param nodeId 节点 ID
     * @param taskType 任务类型
     * @param params 任务参数
     * @param context 执行上下文
     * @returns 节点执行结果
     */
    public async executeTaskNode(
        nodeId: string,
        taskType: string,
        params: Record<string, any>,
        context: ExecutionContext
    ): Promise<NodeExecutionResult> {
        const startedAt = Date.now();

        this.LOGGER.info(`节点 [${nodeId}] 开始执行任务类型: ${taskType}`);

        try {
            // 解析任务参数（合并默认参数和节点配置参数）
            const resolvedParams = await this._paramsResolver.resolveParams(taskType, params, context);

            this.LOGGER.debug(`节点 [${nodeId}] 已解析参数: ${JSON.stringify(resolvedParams)}`);

            // 调度任务并等待完成
            const success = await this._scheduleAndWaitForJob(taskType, resolvedParams, this._taskTimeoutMs);

            const completedAt = Date.now();

            if (success) {
                this.LOGGER.success(
                    `节点 [${nodeId}] 任务执行成功，耗时: ${Math.round((completedAt - startedAt) / 1000)}s`
                );

                return {
                    success: true,
                    output: { taskType, params: resolvedParams },
                    startedAt,
                    completedAt
                };
            } else {
                this.LOGGER.error(`节点 [${nodeId}] 任务执行失败或超时`);

                return {
                    success: false,
                    error: `任务 ${taskType} 执行失败或超时`,
                    startedAt,
                    completedAt
                };
            }
        } catch (error) {
            const completedAt = Date.now();

            this.LOGGER.error(`节点 [${nodeId}] 任务执行异常: ${(error as Error).message}`);

            return {
                success: false,
                error: (error as Error).message,
                startedAt,
                completedAt
            };
        }
    }
}
