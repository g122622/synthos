/**
 * 工作流可视化编排 - 类型定义
 *
 * 注意：此文件定义前端使用的工作流类型，与后端 common/contracts/workflow 保持结构一致
 * 但由于 webui-frontend 必须完全内聚，不允许引用项目根目录/common，因此需要单独定义
 */

/**
 * 节点类型枚举
 */
export type WorkflowNodeType =
    | "start" // 开始节点
    | "end" // 结束节点
    | "task" // 任务节点
    | "condition" // 条件分支节点
    | "parallel" // 并行节点
    | "script" // 脚本节点
    | "http"; // HTTP 请求节点

/**
 * 节点执行状态枚举
 */
export type NodeExecutionStatus =
    | "pending" // 待执行
    | "running" // 执行中
    | "success" // 成功
    | "failed" // 失败
    | "skipped" // 跳过
    | "cancelled"; // 已取消

/**
 * 任务类型（对应后端 TaskHandlerTypes）
 */
export type TaskHandlerType = "ProvideData" | "Preprocess" | "AISummarize" | "GenerateEmbedding" | "InterestScore" | "LLMInterestEvaluationAndNotification";

/**
 * 条件表达式类型
 */
export type ConditionType =
    | "previousNodeSuccess" // 上游节点成功
    | "previousNodeFailed" // 上游节点失败
    | "keyValueMatch"; // 键值匹配

/**
 * HTTP 方法
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

/**
 * HTTP 节点配置
 */
export interface HttpNodeConfig {
    url: string;
    method: HttpMethod;
    headers?: Record<string, string>;
    body?: string;
}

/**
 * 节点数据接口
 */
export interface WorkflowNodeData {
    label: string;

    // Task 节点字段
    taskType?: TaskHandlerType;
    params?: Record<string, any>;
    retryCount?: number;
    timeoutMs?: number;
    skipOnFailure?: boolean;

    // Condition 节点字段
    conditionType?: ConditionType;
    conditionExpression?: Record<string, any>;

    // Script 节点字段
    scriptCode?: string;

    // HTTP 节点字段
    httpConfig?: HttpNodeConfig;

    // 执行状态（运行时）
    status?: NodeExecutionStatus;
    startedAt?: number;
    completedAt?: number;
    error?: string;

    // 索引签名，兼容 React Flow 的 Record<string, unknown> 约束
    [key: string]: any;
}

/**
 * React Flow 节点接口
 */
export interface WorkflowNode {
    id: string;
    type: WorkflowNodeType;
    position: { x: number; y: number };
    data: WorkflowNodeData;
}

/**
 * React Flow 边接口
 */
export interface WorkflowEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string; // 条件节点的出边需要指定 handle (如 "true" 或 "false")
    label?: string;
}

/**
 * 画布视口状态
 */
export interface ViewportState {
    x: number;
    y: number;
    zoom: number;
}

/**
 * 工作流定义接口
 */
export interface WorkflowDefinition {
    id: string;
    name: string;
    description?: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    viewport?: ViewportState;
}

/**
 * 工作流执行记录（完整版）
 */
export interface WorkflowExecution {
    executionId: string;
    workflowId: string;
    status: "pending" | "running" | "completed" | "failed" | "cancelled";
    nodeStates: Record<string, NodeExecutionStatus>;
    startedAt: number;
    completedAt?: number;
    snapshot: WorkflowDefinition;
}

/**
 * 工作流执行摘要（列表展示用）
 */
export interface ExecutionSummary {
    executionId: string;
    workflowId: string;
    status: "pending" | "running" | "success" | "failed" | "cancelled";
    startedAt: number;
    completedAt?: number;
    progress: {
        total: number;
        completed: number;
        failed: number;
        running: number;
    };
}
