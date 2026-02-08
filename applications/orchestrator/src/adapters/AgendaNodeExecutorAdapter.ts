import { NodeExecutionResult, HttpConfig } from "@root/common/contracts/workflow/index";
import { scheduleAndWaitForJob } from "@root/common/scheduler/jobUtils";
import Logger from "@root/common/util/Logger";

import { ExecutionContext } from "../core/ExecutionContext";
import { TaskParamsResolver } from "../core/TaskParamsResolver";

import { NodeExecutorAdapter } from "./NodeExecutorAdapter";

const LOGGER = Logger.withTag("🔌 AgendaNodeExecutorAdapter");

/**
 * Agenda 节点执行器适配器
 * 将工作流节点的执行请求转换为 Agenda 任务调度
 */
export class AgendaNodeExecutorAdapter implements NodeExecutorAdapter {
    private readonly _pollIntervalMs: number;
    private readonly _taskTimeoutMs: number;
    private readonly _paramsResolver: TaskParamsResolver;

    /**
     * 构造函数
     * @param pollIntervalMs 轮询间隔（毫秒）
     * @param taskTimeoutMs 任务超时时间（毫秒）
     * @param paramsResolver 任务参数解析器
     */
    public constructor(
        pollIntervalMs: number = 5000,
        taskTimeoutMs: number = 90 * 60 * 1000,
        paramsResolver: TaskParamsResolver
    ) {
        this._pollIntervalMs = pollIntervalMs;
        this._taskTimeoutMs = taskTimeoutMs;
        this._paramsResolver = paramsResolver;
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

        LOGGER.info(`节点 [${nodeId}] 开始执行任务类型: ${taskType}`);

        try {
            // 解析任务参数（合并默认参数和节点配置参数）
            const resolvedParams = await this._paramsResolver.resolveParams(taskType, params, context);

            LOGGER.debug(`节点 [${nodeId}] 已解析参数: ${JSON.stringify(resolvedParams)}`);

            // 调用 Agenda 调度任务并等待完成
            const success = await scheduleAndWaitForJob(
                taskType,
                resolvedParams,
                this._pollIntervalMs,
                this._taskTimeoutMs
            );

            const completedAt = Date.now();

            if (success) {
                LOGGER.success(
                    `节点 [${nodeId}] 任务执行成功，耗时: ${Math.round((completedAt - startedAt) / 1000)}s`
                );

                return {
                    success: true,
                    output: { taskType, params: resolvedParams },
                    startedAt,
                    completedAt
                };
            } else {
                LOGGER.error(`节点 [${nodeId}] 任务执行失败或超时`);

                return {
                    success: false,
                    error: `任务 ${taskType} 执行失败或超时`,
                    startedAt,
                    completedAt
                };
            }
        } catch (error) {
            const completedAt = Date.now();

            LOGGER.error(`节点 [${nodeId}] 任务执行异常: ${(error as Error).message}`);

            return {
                success: false,
                error: (error as Error).message,
                startedAt,
                completedAt
            };
        }
    }

    /**
     * 执行脚本节点
     * @param nodeId 节点 ID
     * @param scriptCode 脚本代码
     * @param context 执行上下文
     * @returns 节点执行结果
     */
    public async executeScriptNode(
        nodeId: string,
        scriptCode: string,
        context: ExecutionContext
    ): Promise<NodeExecutionResult> {
        const startedAt = Date.now();

        LOGGER.info(`节点 [${nodeId}] 开始执行脚本`);

        try {
            // 创建一个沙箱环境，提供 context 访问
            const sandbox = {
                context,
                console: {
                    log: (...args: any[]) => LOGGER.info(`脚本输出: ${args.join(" ")}`),
                    error: (...args: any[]) => LOGGER.error(`脚本错误: ${args.join(" ")}`)
                }
            };

            // 使用 Function 构造函数执行脚本（比 eval 更安全）
            const fn = new Function("sandbox", `with(sandbox) { ${scriptCode} }`);
            const output = fn(sandbox);

            const completedAt = Date.now();

            LOGGER.success(`节点 [${nodeId}] 脚本执行成功`);

            return {
                success: true,
                output,
                startedAt,
                completedAt
            };
        } catch (error) {
            const completedAt = Date.now();

            LOGGER.error(`节点 [${nodeId}] 脚本执行失败: ${(error as Error).message}`);

            return {
                success: false,
                error: (error as Error).message,
                startedAt,
                completedAt
            };
        }
    }

    /**
     * 执行 HTTP 请求节点
     * @param nodeId 节点 ID
     * @param httpConfig HTTP 配置
     * @param context 执行上下文
     * @returns 节点执行结果
     */
    public async executeHttpNode(
        nodeId: string,
        httpConfig: HttpConfig,
        context: ExecutionContext
    ): Promise<NodeExecutionResult> {
        const startedAt = Date.now();

        LOGGER.info(`节点 [${nodeId}] 开始执行 HTTP 请求: ${httpConfig.method} ${httpConfig.url}`);

        try {
            const response = await fetch(httpConfig.url, {
                method: httpConfig.method,
                headers: httpConfig.headers || {},
                body: httpConfig.body
            });

            const completedAt = Date.now();

            if (response.ok) {
                const data = await response.text();

                LOGGER.success(`节点 [${nodeId}] HTTP 请求成功，状态码: ${response.status}`);

                return {
                    success: true,
                    output: {
                        status: response.status,
                        statusText: response.statusText,
                        data
                    },
                    startedAt,
                    completedAt
                };
            } else {
                LOGGER.error(`节点 [${nodeId}] HTTP 请求失败，状态码: ${response.status}`);

                return {
                    success: false,
                    error: `HTTP 请求失败，状态码: ${response.status}`,
                    startedAt,
                    completedAt
                };
            }
        } catch (error) {
            const completedAt = Date.now();

            LOGGER.error(`节点 [${nodeId}] HTTP 请求异常: ${(error as Error).message}`);

            return {
                success: false,
                error: (error as Error).message,
                startedAt,
                completedAt
            };
        }
    }
}
