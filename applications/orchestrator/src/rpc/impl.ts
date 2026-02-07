/**
 * Orchestrator RPC 实现
 * 实现 OrchestratorRPCImplementation 接口
 */
import { EventEmitter } from "events";

import { injectable, inject } from "tsyringe";
import {
    OrchestratorRPCImplementation,
    ListWorkflowsOutput,
    GetWorkflowInput,
    GetWorkflowOutput,
    TriggerWorkflowInput,
    TriggerWorkflowOutput,
    CancelExecutionInput,
    CancelExecutionOutput,
    RetryExecutionInput,
    RetryExecutionOutput,
    ListExecutionsInput,
    ListExecutionsOutput,
    GetExecutionInput,
    GetExecutionOutput,
    OnExecutionUpdateInput,
    ExecutionUpdateEvent,
    ExecutionSummary,
    NodeStateDTO
} from "@root/common/rpc/orchestrator/index";
import { NodeState } from "@root/common/contracts/workflow/index";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import { COMMON_TOKENS } from "@root/common/di/tokens";
import Logger from "@root/common/util/Logger";

import { WorkflowExecutor } from "../core/WorkflowExecutor";
import { ExecutionPersistence } from "../core/ExecutionPersistence";
import { AgendaNodeExecutorAdapter } from "../adapters/AgendaNodeExecutorAdapter";

const LOGGER = Logger.withTag("🎭 OrchestratorRPCImpl");

/**
 * Orchestrator RPC 实现类
 */
@injectable()
export class OrchestratorRPCImpl implements OrchestratorRPCImplementation {
    private _executors: Map<string, WorkflowExecutor> = new Map();
    private _eventEmitter: EventEmitter = new EventEmitter();

    /**
     * 构造函数
     * @param configManagerService 配置管理服务
     * @param persistence 执行持久化服务
     */
    public constructor(
        @inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService,
        private persistence: ExecutionPersistence
    ) {}

    /**
     * 获取所有工作流定义列表
     * @returns 工作流定义列表
     */
    public async listWorkflows(): Promise<ListWorkflowsOutput> {
        const config = await this.configManagerService.getCurrentConfig();
        const workflows = config.orchestrator.workflows || [];

        return workflows.map(wf => ({
            id: wf.id,
            name: wf.name,
            description: wf.description
        }));
    }

    /**
     * 获取单个工作流定义
     * @param input 工作流 ID
     * @returns 工作流定义
     */
    public async getWorkflow(input: GetWorkflowInput): Promise<GetWorkflowOutput> {
        const config = await this.configManagerService.getCurrentConfig();
        const workflows = config.orchestrator.workflows || [];
        const workflow = workflows.find(wf => wf.id === input.id);

        if (!workflow) {
            throw new Error(`工作流 ${input.id} 不存在`);
        }

        return workflow;
    }

    /**
     * 手动触发流程执行
     * @param input 工作流 ID 和全局变量
     * @returns 触发结果
     */
    public async triggerWorkflow(input: TriggerWorkflowInput): Promise<TriggerWorkflowOutput> {
        try {
            const config = await this.configManagerService.getCurrentConfig();
            const workflows = config.orchestrator.workflows || [];
            const workflow = workflows.find(wf => wf.id === input.workflowId);

            if (!workflow) {
                return {
                    success: false,
                    message: `工作流 ${input.workflowId} 不存在`
                };
            }

            const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(7)}`;

            LOGGER.info(`触发工作流执行: ${workflow.name} (ID: ${executionId})`);

            // 创建适配器
            const adapter = new AgendaNodeExecutorAdapter();

            // 创建执行器
            const executor = new WorkflowExecutor(workflow, executionId, adapter, this.persistence);

            // 保存执行器引用
            this._executors.set(executionId, executor);

            // 监听执行器事件并转发
            executor.on("nodeStarted", (event: any) => {
                this._eventEmitter.emit(`exec:${executionId}`, {
                    type: "nodeStarted",
                    executionId,
                    nodeId: event.nodeId,
                    timestamp: Date.now()
                } as ExecutionUpdateEvent);
            });

            executor.on("nodeCompleted", (event: any) => {
                // 从执行器上下文中获取节点状态
                const nodeState = executor.getExecutionContext().getNodeState(event.nodeId);

                this._eventEmitter.emit(`exec:${executionId}`, {
                    type: "nodeCompleted",
                    executionId,
                    nodeId: event.nodeId,
                    nodeState: nodeState ? this._convertNodeState(nodeState) : undefined,
                    timestamp: Date.now()
                } as ExecutionUpdateEvent);
            });

            executor.on("nodeFailed", (event: any) => {
                // 从执行器上下文中获取节点状态
                const nodeState = executor.getExecutionContext().getNodeState(event.nodeId);

                this._eventEmitter.emit(`exec:${executionId}`, {
                    type: "nodeFailed",
                    executionId,
                    nodeId: event.nodeId,
                    nodeState: nodeState ? this._convertNodeState(nodeState) : undefined,
                    timestamp: Date.now()
                } as ExecutionUpdateEvent);
            });

            executor.on("executionCompleted", () => {
                this._eventEmitter.emit(`exec:${executionId}`, {
                    type: "executionCompleted",
                    executionId,
                    timestamp: Date.now()
                } as ExecutionUpdateEvent);
                this._executors.delete(executionId);
            });

            executor.on("executionFailed", () => {
                this._eventEmitter.emit(`exec:${executionId}`, {
                    type: "executionFailed",
                    executionId,
                    timestamp: Date.now()
                } as ExecutionUpdateEvent);
                this._executors.delete(executionId);
            });

            // 异步执行工作流（不阻塞）
            executor.execute().catch(err => {
                LOGGER.error(`工作流执行失败 (${executionId}): ${err.message}`);
            });

            return {
                success: true,
                executionId,
                message: "工作流执行已启动"
            };
        } catch (error) {
            LOGGER.error(`触发工作流失败: ${(error as Error).message}`);

            return {
                success: false,
                message: (error as Error).message
            };
        }
    }

    /**
     * 取消正在运行的执行
     * @param input 执行 ID
     * @returns 取消结果
     */
    public async cancelExecution(input: CancelExecutionInput): Promise<CancelExecutionOutput> {
        // TODO: 实现取消逻辑
        return {
            success: false,
            message: "取消执行功能暂未实现"
        };
    }

    /**
     * 断点续跑
     * @param input 执行 ID
     * @returns 重试结果
     */
    public async retryExecution(input: RetryExecutionInput): Promise<RetryExecutionOutput> {
        try {
            const execution = await this.persistence.loadExecution(input.executionId!);

            if (!execution) {
                return {
                    success: false,
                    message: `执行 ${input.executionId} 不存在`
                };
            }

            const newExecutionId = `exec_${Date.now()}_${Math.random().toString(36).substring(7)}`;

            LOGGER.info(`断点续跑: ${input.executionId} → ${newExecutionId}`);

            const adapter = new AgendaNodeExecutorAdapter();
            const executor = new WorkflowExecutor(execution.snapshot, newExecutionId, adapter, this.persistence);

            this._executors.set(newExecutionId, executor);

            // 监听事件（同 triggerWorkflow）
            executor.on("executionCompleted", () => this._executors.delete(newExecutionId));
            executor.on("executionFailed", () => this._executors.delete(newExecutionId));

            // 从保存的状态恢复
            executor.execute(true).catch(err => {
                LOGGER.error(`断点续跑失败 (${newExecutionId}): ${err.message}`);
            });

            return {
                success: true,
                newExecutionId,
                message: "断点续跑已启动"
            };
        } catch (error) {
            LOGGER.error(`断点续跑失败: ${(error as Error).message}`);

            return {
                success: false,
                message: (error as Error).message
            };
        }
    }

    /**
     * 获取执行历史列表
     * @param input 工作流 ID 和分页参数
     * @returns 执行历史列表
     */
    public async listExecutions(input: ListExecutionsInput): Promise<ListExecutionsOutput> {
        const executions = await this.persistence.listExecutions(input.workflowId!, input.limit);

        return executions
            .map(exec => this._convertToExecutionSummary(exec))
            .filter(exec => exec.executionId != null);
    }

    /**
     * 获取单次执行详情
     * @param input 执行 ID
     * @returns 执行详情
     */
    public async getExecution(input: GetExecutionInput): Promise<GetExecutionOutput> {
        const execution = await this.persistence.loadExecution(input.executionId!);

        if (!execution || !execution.executionId) {
            throw new Error(`执行 ${input.executionId} 不存在`);
        }

        return {
            executionId: execution.executionId,
            workflowId: execution.workflowId,
            status: execution.status,
            nodeStates: Array.from(execution.nodeStates.values()).map(ns => this._convertNodeState(ns)),
            startedAt: execution.startedAt,
            completedAt: execution.completedAt,
            snapshot: execution.snapshot
        };
    }

    /**
     * 订阅执行状态更新
     * @param input 执行 ID
     * @param onChunk 事件回调
     */
    public async onExecutionUpdate(
        input: OnExecutionUpdateInput,
        onChunk: (event: ExecutionUpdateEvent) => void
    ): Promise<void> {
        const eventName = `exec:${input.executionId}`;

        const handler = (event: ExecutionUpdateEvent) => {
            onChunk(event);
        };

        this._eventEmitter.on(eventName, handler);

        // 返回清理函数（虽然接口是 Promise<void>，实际清理由订阅方负责）
        // 这里只是简单等待，实际清理在 subscription 取消时进行
        return new Promise(() => {
            // 永不 resolve，直到订阅被取消
        });
    }

    /**
     * 转换 NodeState 到 DTO 格式
     */
    private _convertNodeState(nodeState: NodeState): NodeStateDTO {
        return {
            nodeId: nodeState.nodeId,
            status: nodeState.status,
            result: nodeState.result
        };
    }

    /**
     * 转换 WorkflowExecution 到 ExecutionSummary
     */
    private _convertToExecutionSummary(execution: any): ExecutionSummary {
        const nodeStates = Array.from((execution.nodeStates as Map<string, NodeState>).values());
        const total = nodeStates.length;
        const completed = nodeStates.filter(ns => ns.status === "success").length;
        const failed = nodeStates.filter(ns => ns.status === "failed").length;
        const running = nodeStates.filter(ns => ns.status === "running").length;

        return {
            executionId: execution.executionId,
            workflowId: execution.workflowId,
            status: execution.status,
            startedAt: execution.startedAt,
            completedAt: execution.completedAt,
            progress: {
                total,
                completed,
                failed,
                running
            }
        };
    }
}
