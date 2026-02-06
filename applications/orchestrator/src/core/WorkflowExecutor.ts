import { EventEmitter } from "events";

import {
    WorkflowDefinition,
    WorkflowNode,
    WorkflowNodeType,
    NodeExecutionStatus,
    NodeExecutionResult,
    WorkflowExecutionStatus,
    WorkflowExecution
} from "@root/common/contracts/workflow/index";
import Logger from "@root/common/util/Logger";

import { NodeExecutorAdapter } from "../adapters/NodeExecutorAdapter";

import { ExecutionContext } from "./ExecutionContext";
import { DagParser } from "./DagParser";
import { ConditionEvaluator } from "./ConditionEvaluator";
import { NodeExecutionStrategy } from "./NodeExecutionStrategy";

const LOGGER = Logger.withTag("🎯 WorkflowExecutor");

/**
 * 工作流执行器
 * 负责解析工作流定义，按照 DAG 拓扑顺序执行节点
 */
export class WorkflowExecutor extends EventEmitter {
    private _workflowDefinition: WorkflowDefinition;
    private _executionSnapshot: WorkflowDefinition;
    private _executionContext: ExecutionContext;
    private _adapter: NodeExecutorAdapter;
    private _conditionEvaluator: ConditionEvaluator;
    private _executionStrategy: NodeExecutionStrategy;
    private _executionId: string;
    private _nodeMap: Map<string, WorkflowNode>;

    /**
     * 构造函数
     * @param workflowDefinition 工作流定义
     * @param executionId 执行 ID
     * @param adapter 节点执行器适配器
     */
    public constructor(workflowDefinition: WorkflowDefinition, executionId: string, adapter: NodeExecutorAdapter) {
        super();
        this._workflowDefinition = workflowDefinition;
        this._executionId = executionId;
        this._adapter = adapter;
        this._conditionEvaluator = new ConditionEvaluator();
        this._executionStrategy = new NodeExecutionStrategy();

        // 深拷贝工作流定义作为快照（运行期间不受修改影响）
        this._executionSnapshot = structuredClone(workflowDefinition);
        this._executionContext = new ExecutionContext(executionId);

        // 构建节点映射
        this._nodeMap = new Map();
        for (const node of this._executionSnapshot.nodes) {
            this._nodeMap.set(node.id, node);
        }

        LOGGER.info(`工作流执行器已创建，执行 ID: ${executionId}，工作流: ${workflowDefinition.name}`);
    }

    /**
     * 执行工作流
     * @returns 工作流执行实例
     */
    public async execute(): Promise<WorkflowExecution> {
        const startedAt = Date.now();

        LOGGER.info(`开始执行工作流 [${this._executionSnapshot.name}] (ID: ${this._executionId})`);

        this.emit("executionStarted", {
            executionId: this._executionId,
            workflowId: this._executionSnapshot.id,
            startedAt
        });

        try {
            // 1. 解析 DAG 并生成执行计划
            const parser = new DagParser(this._executionSnapshot);
            const executionPlan = parser.parse();

            LOGGER.info(`执行计划已生成，共 ${executionPlan.layers.length} 层`);

            // 2. 逐层执行节点
            for (let layerIndex = 0; layerIndex < executionPlan.layers.length; layerIndex++) {
                const layer = executionPlan.layers[layerIndex];

                LOGGER.info(
                    `开始执行第 ${layerIndex + 1}/${executionPlan.layers.length} 层，节点: ${layer.join(", ")}`
                );

                // 检查该层的所有节点是否可以执行（前置节点是否完成）
                const executableNodes = this._filterExecutableNodes(layer);

                if (executableNodes.length === 0) {
                    LOGGER.warning(`第 ${layerIndex + 1} 层没有可执行节点，跳过`);
                    continue;
                }

                // 并行执行该层的所有节点
                await this._executeLayer(executableNodes);
            }

            const completedAt = Date.now();

            LOGGER.success(
                `工作流 [${this._executionSnapshot.name}] 执行完成，耗时: ${Math.round((completedAt - startedAt) / 1000)}s`
            );

            this.emit("executionCompleted", {
                executionId: this._executionId,
                workflowId: this._executionSnapshot.id,
                completedAt
            });

            return {
                executionId: this._executionId,
                workflowId: this._executionSnapshot.id,
                status: WorkflowExecutionStatus.Success,
                nodeStates: this._executionContext.getAllNodeStates(),
                startedAt,
                completedAt,
                snapshot: this._executionSnapshot
            };
        } catch (error) {
            const completedAt = Date.now();

            LOGGER.error(`工作流 [${this._executionSnapshot.name}] 执行失败: ${(error as Error).message}`);

            this.emit("executionFailed", {
                executionId: this._executionId,
                workflowId: this._executionSnapshot.id,
                error: (error as Error).message,
                completedAt
            });

            // 将所有未完成的节点标记为 Cancelled
            this._cancelUnfinishedNodes();

            return {
                executionId: this._executionId,
                workflowId: this._executionSnapshot.id,
                status: WorkflowExecutionStatus.Failed,
                nodeStates: this._executionContext.getAllNodeStates(),
                startedAt,
                completedAt,
                snapshot: this._executionSnapshot
            };
        }
    }

    /**
     * 过滤可执行的节点（检查前置节点是否完成）
     * @param nodeIds 候选节点 ID 列表
     * @returns 可执行的节点 ID 列表
     */
    private _filterExecutableNodes(nodeIds: string[]): string[] {
        const executableNodes: string[] = [];

        for (const nodeId of nodeIds) {
            const node = this._nodeMap.get(nodeId);

            if (!node) {
                continue;
            }

            // 获取该节点的所有入边
            const incomingEdges = this._executionSnapshot.edges.filter(edge => edge.target === nodeId);

            // 检查所有前置节点是否已完成
            let allPredecessorsCompleted = true;

            for (const edge of incomingEdges) {
                const predecessorId = edge.source;
                const predecessorState = this._executionContext.getNodeState(predecessorId);

                // 如果前置节点未完成，则当前节点不可执行
                if (
                    !predecessorState ||
                    (predecessorState.status !== NodeExecutionStatus.Success &&
                        predecessorState.status !== NodeExecutionStatus.Failed &&
                        predecessorState.status !== NodeExecutionStatus.Skipped)
                ) {
                    allPredecessorsCompleted = false;
                    break;
                }
            }

            if (allPredecessorsCompleted) {
                executableNodes.push(nodeId);
            }
        }

        return executableNodes;
    }

    /**
     * 并行执行一层的所有节点
     * @param nodeIds 节点 ID 列表
     */
    private async _executeLayer(nodeIds: string[]): Promise<void> {
        const promises = nodeIds.map(nodeId => this._executeNode(nodeId));

        // 使用 allSettled 确保所有节点都执行完毕（即使有失败）
        const results = await Promise.allSettled(promises);

        // 检查是否有节点执行失败（且未设置 skipOnFailure）
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const nodeId = nodeIds[i];

            if (result.status === "rejected") {
                const node = this._nodeMap.get(nodeId);
                const skipOnFailure = node?.data.skipOnFailure || false;

                if (!skipOnFailure) {
                    throw new Error(`节点 [${nodeId}] 执行失败，流程终止: ${result.reason}`);
                }
            }
        }
    }

    /**
     * 执行单个节点
     * @param nodeId 节点 ID
     */
    private async _executeNode(nodeId: string): Promise<void> {
        const node = this._nodeMap.get(nodeId);

        if (!node) {
            throw new Error(`节点 [${nodeId}] 不存在`);
        }

        LOGGER.info(`节点 [${nodeId}] (${node.data.label}) 开始执行，类型: ${node.type}`);

        // 更新节点状态为 Running
        this._executionContext.updateNodeStatus(nodeId, NodeExecutionStatus.Running);
        this.emit("nodeStarted", { nodeId, executionId: this._executionId });

        try {
            let result: NodeExecutionResult;

            // 根据节点类型执行不同的逻辑
            switch (node.type) {
                case WorkflowNodeType.Start:
                case WorkflowNodeType.End:
                    // Start 和 End 节点不执行任何逻辑，直接标记为成功
                    result = {
                        success: true,
                        output: {},
                        startedAt: Date.now(),
                        completedAt: Date.now()
                    };
                    break;

                case WorkflowNodeType.Task:
                    result = await this._executeTaskNode(node);
                    break;

                case WorkflowNodeType.Condition:
                    result = await this._executeConditionNode(node);
                    break;

                case WorkflowNodeType.Script:
                    result = await this._executeScriptNode(node);
                    break;

                case WorkflowNodeType.Http:
                    result = await this._executeHttpNode(node);
                    break;

                case WorkflowNodeType.Parallel:
                    // Parallel 节点不执行任何逻辑，仅作为标记
                    result = {
                        success: true,
                        output: {},
                        startedAt: Date.now(),
                        completedAt: Date.now()
                    };
                    break;

                default:
                    throw new Error(`不支持的节点类型: ${node.type}`);
            }

            // 保存节点执行结果
            this._executionContext.setNodeResult(nodeId, result);

            // 更新节点状态
            const finalStatus = result.success ? NodeExecutionStatus.Success : NodeExecutionStatus.Failed;

            this._executionContext.setNodeState(nodeId, {
                nodeId,
                status: finalStatus,
                result
            });

            if (result.success) {
                LOGGER.success(`节点 [${nodeId}] 执行成功`);
                this.emit("nodeCompleted", { nodeId, executionId: this._executionId, result });
            } else {
                LOGGER.error(`节点 [${nodeId}] 执行失败: ${result.error}`);
                this.emit("nodeFailed", { nodeId, executionId: this._executionId, result });

                // 如果节点未设置 skipOnFailure，抛出异常终止流程
                if (!node.data.skipOnFailure) {
                    throw new Error(`节点 [${nodeId}] 执行失败: ${result.error}`);
                }
            }
        } catch (error) {
            // 记录失败状态
            this._executionContext.setNodeState(nodeId, {
                nodeId,
                status: node.data.skipOnFailure ? NodeExecutionStatus.Skipped : NodeExecutionStatus.Failed,
                result: {
                    success: false,
                    error: (error as Error).message,
                    startedAt: Date.now(),
                    completedAt: Date.now()
                }
            });

            this.emit("nodeFailed", {
                nodeId,
                executionId: this._executionId,
                error: (error as Error).message
            });

            throw error;
        }
    }

    /**
     * 执行任务节点
     * @param node 节点
     * @returns 节点执行结果
     */
    private async _executeTaskNode(node: WorkflowNode): Promise<NodeExecutionResult> {
        if (!node.data.taskType) {
            throw new Error(`任务节点 [${node.id}] 缺少 taskType 配置`);
        }

        const config = {
            nodeId: node.id,
            retryCount: node.data.retryCount || 0,
            timeoutMs: node.data.timeoutMs || 0,
            skipOnFailure: node.data.skipOnFailure || false
        };

        return await this._executionStrategy.executeWithStrategy(config, async () => {
            return await this._adapter.executeTaskNode(
                node.id,
                node.data.taskType!,
                node.data.params || {},
                this._executionContext
            );
        });
    }

    /**
     * 执行条件节点
     * @param node 节点
     * @returns 节点执行结果
     */
    private async _executeConditionNode(node: WorkflowNode): Promise<NodeExecutionResult> {
        if (!node.data.conditionExpression) {
            throw new Error(`条件节点 [${node.id}] 缺少 conditionExpression 配置`);
        }

        // 获取该条件节点的所有入边（应该只有一条）
        const incomingEdges = this._executionSnapshot.edges.filter(edge => edge.target === node.id);

        if (incomingEdges.length === 0) {
            throw new Error(`条件节点 [${node.id}] 没有入边`);
        }

        const sourceNodeId = incomingEdges[0].source;

        // 求值条件表达式
        const conditionResult = this._conditionEvaluator.evaluate(
            node.data.conditionExpression,
            sourceNodeId,
            this._executionContext
        );

        LOGGER.info(`条件节点 [${node.id}] 求值结果: ${conditionResult}`);

        return {
            success: true,
            output: { conditionResult },
            startedAt: Date.now(),
            completedAt: Date.now()
        };
    }

    /**
     * 执行脚本节点
     * @param node 节点
     * @returns 节点执行结果
     */
    private async _executeScriptNode(node: WorkflowNode): Promise<NodeExecutionResult> {
        if (!node.data.scriptCode) {
            throw new Error(`脚本节点 [${node.id}] 缺少 scriptCode 配置`);
        }

        const config = {
            nodeId: node.id,
            retryCount: node.data.retryCount || 0,
            timeoutMs: node.data.timeoutMs || 0,
            skipOnFailure: node.data.skipOnFailure || false
        };

        return await this._executionStrategy.executeWithStrategy(config, async () => {
            return await this._adapter.executeScriptNode(node.id, node.data.scriptCode!, this._executionContext);
        });
    }

    /**
     * 执行 HTTP 节点
     * @param node 节点
     * @returns 节点执行结果
     */
    private async _executeHttpNode(node: WorkflowNode): Promise<NodeExecutionResult> {
        if (!node.data.httpConfig) {
            throw new Error(`HTTP 节点 [${node.id}] 缺少 httpConfig 配置`);
        }

        const config = {
            nodeId: node.id,
            retryCount: node.data.retryCount || 0,
            timeoutMs: node.data.timeoutMs || 0,
            skipOnFailure: node.data.skipOnFailure || false
        };

        return await this._executionStrategy.executeWithStrategy(config, async () => {
            return await this._adapter.executeHttpNode(node.id, node.data.httpConfig!, this._executionContext);
        });
    }

    /**
     * 取消所有未完成的节点
     */
    private _cancelUnfinishedNodes(): void {
        for (const node of this._executionSnapshot.nodes) {
            const state = this._executionContext.getNodeState(node.id);

            if (!state || state.status === NodeExecutionStatus.Pending) {
                this._executionContext.setNodeState(node.id, {
                    nodeId: node.id,
                    status: NodeExecutionStatus.Cancelled
                });
            }
        }
    }

    /**
     * 获取执行上下文
     * @returns 执行上下文
     */
    public getExecutionContext(): ExecutionContext {
        return this._executionContext;
    }

    /**
     * 获取执行 ID
     * @returns 执行 ID
     */
    public getExecutionId(): string {
        return this._executionId;
    }
}
