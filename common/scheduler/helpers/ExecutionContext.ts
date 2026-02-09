import { NodeExecutionResult, NodeExecutionStatus, NodeState } from "../../contracts/workflow/index";

/**
 * 执行上下文类
 *
 * 管理工作流执行过程中的全局状态、节点输出和共享变量
 *
 * 一个WorkflowExecutor持有一个ExecutionContext实例，
 * 随着工作流执行的推进，ExecutionContext会不断更新节点状态和结果，
 * 并提供接口供节点执行器查询和修改上下文数据
 */
export class ExecutionContext {
    /** 节点执行结果映射：nodeId -> NodeExecutionResult */
    // TODO _nodeStates 已经包含了每个节点的执行结果了，这个 _nodeResults 是不是有点冗余了？需要评估一下能否删掉
    private _nodeResults: Map<string, NodeExecutionResult>;

    /** 节点状态映射：nodeId -> NodeState */
    private _nodeStates: Map<string, NodeState>;

    /** 全局变量区：用于存储跨节点共享的数据 */
    private _globalVars: Map<string, any>;

    /** 执行 ID */
    private _executionId: string;

    /**
     * 构造函数
     * @param executionId 执行实例的唯一标识符
     */
    public constructor(executionId: string) {
        this._executionId = executionId;
        this._nodeResults = new Map();
        this._nodeStates = new Map();
        this._globalVars = new Map();
    }

    /**
     * 获取执行 ID
     */
    public getExecutionId(): string {
        return this._executionId;
    }

    /**
     * 设置节点的执行结果
     * @param nodeId 节点 ID
     * @param result 执行结果
     */
    public setNodeResult(nodeId: string, result: NodeExecutionResult): void {
        this._nodeResults.set(nodeId, result);
    }

    /**
     * 获取节点的执行结果
     * @param nodeId 节点 ID
     * @returns 执行结果，如果节点尚未执行则返回 undefined
     */
    public getNodeResult(nodeId: string): NodeExecutionResult | undefined {
        return this._nodeResults.get(nodeId);
    }

    /**
     * 获取上游节点的输出数据
     * 便捷方法，直接返回节点的 output 字段
     * @param nodeId 节点 ID
     * @returns 节点输出数据，如果节点尚未执行或无输出则返回 undefined
     */
    public getUpstreamOutput(nodeId: string): any | undefined {
        const result = this._nodeResults.get(nodeId);

        return result?.output;
    }

    /**
     * 检查节点是否已执行完成（成功或失败）
     * @param nodeId 节点 ID
     * @returns 如果节点已完成则返回 true
     */
    public isNodeCompleted(nodeId: string): boolean {
        const result = this._nodeResults.get(nodeId);

        return result !== undefined;
    }

    /**
     * 检查节点是否执行成功
     * @param nodeId 节点 ID
     * @returns 如果节点执行成功则返回 true
     */
    public isNodeSuccess(nodeId: string): boolean {
        const result = this._nodeResults.get(nodeId);

        return result?.success === true;
    }

    /**
     * 检查节点是否执行失败
     * @param nodeId 节点 ID
     * @returns 如果节点执行失败则返回 true
     */
    public isNodeFailed(nodeId: string): boolean {
        const result = this._nodeResults.get(nodeId);

        return result !== undefined && result.success === false;
    }

    /**
     * 设置节点状态
     * @param nodeId 节点 ID
     * @param state 节点状态
     */
    public setNodeState(nodeId: string, state: NodeState): void {
        this._nodeStates.set(nodeId, state);
    }

    /**
     * 获取节点状态
     * @param nodeId 节点 ID
     * @returns 节点状态，如果节点状态未设置则返回 undefined
     */
    public getNodeState(nodeId: string): NodeState | undefined {
        return this._nodeStates.get(nodeId);
    }

    /**
     * 更新节点状态（仅更新 status 字段）
     * @param nodeId 节点 ID
     * @param status 新的执行状态
     */
    public updateNodeStatus(nodeId: string, status: NodeExecutionStatus): void {
        const existingState = this._nodeStates.get(nodeId);

        if (existingState) {
            existingState.status = status;
        } else {
            this._nodeStates.set(nodeId, { nodeId, status });
        }
    }

    /**
     * 获取所有节点状态的快照
     * @returns 节点状态映射的副本
     */
    public getAllNodeStates(): Map<string, NodeState> {
        return new Map(this._nodeStates);
    }

    /**
     * 设置全局变量
     * @param key 变量键
     * @param value 变量值
     */
    public setGlobalVar(key: string, value: any): void {
        this._globalVars.set(key, value);
    }

    /**
     * 获取全局变量
     * @param key 变量键
     * @returns 变量值，如果不存在则返回 undefined
     */
    public getGlobalVar(key: string): any | undefined {
        return this._globalVars.get(key);
    }

    /**
     * 检查全局变量是否存在
     * @param key 变量键
     * @returns 如果变量存在则返回 true
     */
    public hasGlobalVar(key: string): boolean {
        return this._globalVars.has(key);
    }

    /**
     * 删除全局变量
     * @param key 变量键
     */
    public deleteGlobalVar(key: string): void {
        this._globalVars.delete(key);
    }

    /**
     * 获取所有全局变量的快照
     * @returns 全局变量映射的副本
     */
    public getAllGlobalVars(): Map<string, any> {
        return new Map(this._globalVars);
    }

    /**
     * 清空执行上下文（用于重置或清理）
     */
    public clear(): void {
        this._nodeResults.clear();
        this._nodeStates.clear();
        this._globalVars.clear();
    }

    /**
     * 序列化上下文状态（用于持久化）
     * 注意：Map 会被转换为对象数组
     */
    public serialize(): {
        executionId: string;
        nodeResults: Array<[string, NodeExecutionResult]>;
        nodeStates: Array<[string, NodeState]>;
        globalVars: Array<[string, any]>;
    } {
        return {
            executionId: this._executionId,
            nodeResults: Array.from(this._nodeResults.entries()),
            nodeStates: Array.from(this._nodeStates.entries()),
            globalVars: Array.from(this._globalVars.entries())
        };
    }

    /**
     * 从序列化数据恢复上下文状态（用于断点续跑）
     */
    public static deserialize(data: {
        executionId: string;
        nodeResults: Array<[string, NodeExecutionResult]>;
        nodeStates: Array<[string, NodeState]>;
        globalVars: Array<[string, any]>;
    }): ExecutionContext {
        const context = new ExecutionContext(data.executionId);

        context._nodeResults = new Map(data.nodeResults);
        context._nodeStates = new Map(data.nodeStates);
        context._globalVars = new Map(data.globalVars);

        return context;
    }
}
