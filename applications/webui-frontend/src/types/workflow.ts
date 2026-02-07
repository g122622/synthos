/**
 * Workflow 工作流编排相关类型定义
 * 用于前端全局类型引用，与 pages/workflow/types/index.ts 保持一致
 */

export type WorkflowNodeType = "start" | "end" | "task" | "condition" | "parallel" | "script" | "http";

export type NodeExecutionStatus = "pending" | "running" | "success" | "failed" | "skipped" | "cancelled";

export type WorkflowExecutionStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface WorkflowNode {
    id: string;
    type: WorkflowNodeType;
    position: { x: number; y: number };
    data: {
        label: string;
        taskType?: string;
        params?: Record<string, any>;
        retryCount?: number;
        timeoutMs?: number;
        skipOnFailure?: boolean;
        conditionExpression?: ConditionExpression;
        scriptCode?: string;
        httpConfig?: HttpNodeConfig;
    };
}

export interface WorkflowEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    label?: string;
}

export interface WorkflowDefinition {
    id: string;
    name: string;
    description: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    viewport?: { x: number; y: number; zoom: number };
}

export interface ConditionExpression {
    type: "previousNodeSuccess" | "previousNodeFailed" | "keyValueMatch" | "customExpression";
    nodeId?: string;
    key?: string;
    value?: any;
    operator?: ">" | "<" | ">=" | "<=" | "===" | "!==";
    code?: string;
}

export interface HttpNodeConfig {
    url: string;
    method: "GET" | "POST" | "PUT" | "DELETE";
    headers?: Record<string, string>;
    body?: string;
}

export interface NodeState {
    status: NodeExecutionStatus;
    startedAt?: number;
    completedAt?: number;
    output?: any;
    error?: string;
}

export interface WorkflowExecution {
    executionId: string;
    workflowId: string;
    status: WorkflowExecutionStatus;
    nodeStates: Record<string, NodeState>;
    startedAt: number;
    completedAt?: number;
    snapshot: WorkflowDefinition;
}
