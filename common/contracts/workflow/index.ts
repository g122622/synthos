import { z } from "zod";

import { TaskHandlerTypes } from "../../scheduler/@types/Tasks";

/**
 * 工作流节点类型枚举
 */
export enum WorkflowNodeType {
    /** 开始节点 */
    Start = "start",
    /** 结束节点 */
    End = "end",
    /** 任务节点（调用 Agenda task） */
    Task = "task",
    /** 条件分支节点 */
    Condition = "condition",
    /** 并行节点 */
    Parallel = "parallel",
    /** 脚本节点（执行自定义 JavaScript） */
    Script = "script",
    /** HTTP 请求节点 */
    Http = "http"
}

/**
 * 节点执行状态枚举
 */
export enum NodeExecutionStatus {
    /** 等待执行 */
    Pending = "pending",
    /** 正在执行 */
    Running = "running",
    /** 执行成功 */
    Success = "success",
    /** 执行失败 */
    Failed = "failed",
    /** 跳过执行 */
    Skipped = "skipped",
    /** 已取消 */
    Cancelled = "cancelled"
}

/**
 * 工作流执行状态枚举
 */
export enum WorkflowExecutionStatus {
    /** 等待执行 */
    Pending = "pending",
    /** 正在执行 */
    Running = "running",
    /** 执行成功 */
    Success = "success",
    /** 执行失败 */
    Failed = "failed",
    /** 已取消 */
    Cancelled = "cancelled"
}

/**
 * 条件表达式类型枚举
 */
export enum ConditionExpressionType {
    /** 上游节点执行成功 */
    PreviousNodeSuccess = "previousNodeSuccess",
    /** 上游节点执行失败 */
    PreviousNodeFailed = "previousNodeFailed",
    /** 键值匹配 */
    KeyValueMatch = "keyValueMatch",
    /** 自定义 JavaScript 表达式 */
    CustomExpression = "customExpression"
}

/**
 * 条件表达式接口
 */
export interface ConditionExpression {
    type: ConditionExpressionType;
    /** 键值匹配的键路径（如 "previousNode.success"） */
    keyPath?: string;
    /** 期望的值 */
    expectedValue?: any;
    /** 自定义 JavaScript 表达式字符串 */
    customCode?: string;
}

/**
 * HTTP 配置接口
 */
export interface HttpConfig {
    url: string;
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    headers?: Record<string, string>;
    body?: string;
}

/**
 * 工作流节点数据接口
 */
export interface WorkflowNodeData {
    /** 节点显示标签 */
    label: string;
    /** 任务类型（仅 type="task" 时有效） */
    taskType?: TaskHandlerTypes;
    /** 节点参数 */
    params?: Record<string, any>;
    /** 重试次数 */
    retryCount?: number;
    /** 超时时间（毫秒） */
    timeoutMs?: number;
    /** 失败时是否跳过（不中断整个流程） */
    skipOnFailure?: boolean;
    /** 条件表达式（仅 type="condition" 时） */
    conditionExpression?: ConditionExpression;
    /** 脚本代码（仅 type="script" 时） */
    scriptCode?: string;
    /** HTTP 配置（仅 type="http" 时） */
    httpConfig?: HttpConfig;
}

/**
 * 工作流节点接口
 */
export interface WorkflowNode {
    id: string;
    type: WorkflowNodeType;
    /** React Flow 画布位置 */
    position: { x: number; y: number };
    data: WorkflowNodeData;
}

/**
 * 工作流边接口
 */
export interface WorkflowEdge {
    id: string;
    /** 源节点 ID */
    source: string;
    /** 目标节点 ID */
    target: string;
    /** 源节点的输出句柄（用于条件分支） */
    sourceHandle?: string;
    /** 边的标签（如 "true" / "false"） */
    label?: string;
}

/**
 * 工作流定义接口
 */
export interface WorkflowDefinition {
    id: string;
    name: string;
    description: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    /** React Flow 画布 viewport 状态（用于保存/恢复） */
    viewport?: { x: number; y: number; zoom: number };
}

/**
 * 节点执行结果接口
 */
export interface NodeExecutionResult {
    /** 是否执行成功 */
    success: boolean;
    /** 节点输出数据 */
    output?: any;
    /** 错误信息 */
    error?: string;
    /** 开始时间（毫秒级时间戳） */
    startedAt: number;
    /** 完成时间（毫秒级时间戳） */
    completedAt: number;
}

/**
 * 节点状态接口
 */
export interface NodeState {
    nodeId: string;
    status: NodeExecutionStatus;
    result?: NodeExecutionResult;
}

/**
 * 工作流执行实例接口
 */
export interface WorkflowExecution {
    /** 执行 ID */
    executionId: string;
    /** 工作流定义 ID */
    workflowId: string;
    /** 执行状态 */
    status: WorkflowExecutionStatus;
    /** 各节点状态 */
    nodeStates: Map<string, NodeState>;
    /** 开始时间（毫秒级时间戳） */
    startedAt: number;
    /** 完成时间（毫秒级时间戳） */
    completedAt?: number;
    /** 工作流定义快照（深拷贝，运行期间不受修改影响） */
    snapshot: WorkflowDefinition;
}

/**
 * 执行计划 - 用于描述 DAG 的执行顺序
 */
export interface ExecutionPlan {
    /** 分层的节点 ID 列表，每层内的节点可以并行执行 */
    layers: string[][];
    /** 并行分支信息：记录哪些节点是并行分支的起点 */
    parallelBranches: Map<string, string[]>;
    /** 汇聚点信息：记录哪些节点是汇聚点（多条入边） */
    convergencePoints: Set<string>;
}

// ==================== Zod Schema 定义 ====================

/**
 * ConditionExpression 的 Zod Schema
 */
export const ConditionExpressionSchema = z.object({
    type: z.nativeEnum(ConditionExpressionType),
    keyPath: z.string().optional(),
    expectedValue: z.any().optional(),
    customCode: z.string().optional()
});

/**
 * HttpConfig 的 Zod Schema
 */
export const HttpConfigSchema = z.object({
    url: z.string().url(),
    method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
    headers: z.record(z.string()).optional(),
    body: z.string().optional()
});

/**
 * WorkflowNodeData 的 Zod Schema
 */
export const WorkflowNodeDataSchema = z.object({
    label: z.string(),
    taskType: z.nativeEnum(TaskHandlerTypes).optional(),
    params: z.record(z.any()).optional(),
    retryCount: z.number().int().min(0).optional(),
    timeoutMs: z.number().int().min(0).optional(),
    skipOnFailure: z.boolean().optional(),
    conditionExpression: ConditionExpressionSchema.optional(),
    scriptCode: z.string().optional(),
    httpConfig: HttpConfigSchema.optional()
});

/**
 * WorkflowNode 的 Zod Schema
 */
export const WorkflowNodeSchema = z.object({
    id: z.string(),
    type: z.nativeEnum(WorkflowNodeType),
    position: z.object({
        x: z.number(),
        y: z.number()
    }),
    data: WorkflowNodeDataSchema
});

/**
 * WorkflowEdge 的 Zod Schema
 */
export const WorkflowEdgeSchema = z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    sourceHandle: z.string().optional(),
    label: z.string().optional()
});

/**
 * WorkflowDefinition 的 Zod Schema
 */
export const WorkflowDefinitionSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    nodes: z.array(WorkflowNodeSchema),
    edges: z.array(WorkflowEdgeSchema),
    viewport: z
        .object({
            x: z.number(),
            y: z.number(),
            zoom: z.number()
        })
        .optional()
});
