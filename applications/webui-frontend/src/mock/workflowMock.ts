/**
 * Workflow 工作流编排 Mock 数据
 * 用于在只启动前端时展示工作流编排 UI 效果
 */

import type { WorkflowDefinition, WorkflowExecution, NodeExecutionStatus, WorkflowExecutionStatus } from "@/types/workflow";

/**
 * 模拟的默认工作流定义
 */
export const mockDefaultWorkflow: WorkflowDefinition = {
    id: "default-pipeline",
    name: "标准数据处理流程",
    description: "ProvideData → Preprocess → AISummarize → GenerateEmbedding → InterestScore",
    nodes: [
        {
            id: "start",
            type: "start",
            position: { x: 100, y: 200 },
            data: {
                label: "开始"
            }
        },
        {
            id: "provide-data",
            type: "task",
            position: { x: 300, y: 200 },
            data: {
                label: "提供数据",
                taskType: "ProvideData",
                params: {},
                retryCount: 3,
                timeoutMs: 600000,
                skipOnFailure: false
            }
        },
        {
            id: "preprocess",
            type: "task",
            position: { x: 500, y: 200 },
            data: {
                label: "预处理",
                taskType: "Preprocess",
                params: {},
                retryCount: 2,
                timeoutMs: 300000,
                skipOnFailure: false
            }
        },
        {
            id: "ai-summarize",
            type: "task",
            position: { x: 700, y: 200 },
            data: {
                label: "AI 摘要",
                taskType: "AISummarize",
                params: {},
                retryCount: 1,
                timeoutMs: 900000,
                skipOnFailure: false
            }
        },
        {
            id: "parallel-start",
            type: "parallel",
            position: { x: 900, y: 200 },
            data: {
                label: "并行起始"
            }
        },
        {
            id: "generate-embedding",
            type: "task",
            position: { x: 1100, y: 100 },
            data: {
                label: "生成向量嵌入",
                taskType: "GenerateEmbedding",
                params: {},
                retryCount: 2,
                timeoutMs: 600000,
                skipOnFailure: false
            }
        },
        {
            id: "interest-score",
            type: "task",
            position: { x: 1100, y: 300 },
            data: {
                label: "兴趣度评分",
                taskType: "InterestScore",
                params: {},
                retryCount: 2,
                timeoutMs: 600000,
                skipOnFailure: false
            }
        },
        {
            id: "parallel-end",
            type: "parallel",
            position: { x: 1300, y: 200 },
            data: {
                label: "并行汇聚"
            }
        },
        {
            id: "end",
            type: "end",
            position: { x: 1500, y: 200 },
            data: {
                label: "结束"
            }
        }
    ],
    edges: [
        { id: "e1", source: "start", target: "provide-data" },
        { id: "e2", source: "provide-data", target: "preprocess" },
        { id: "e3", source: "preprocess", target: "ai-summarize" },
        { id: "e4", source: "ai-summarize", target: "parallel-start" },
        { id: "e5", source: "parallel-start", target: "generate-embedding" },
        { id: "e6", source: "parallel-start", target: "interest-score" },
        { id: "e7", source: "generate-embedding", target: "parallel-end" },
        { id: "e8", source: "interest-score", target: "parallel-end" },
        { id: "e9", source: "parallel-end", target: "end" }
    ],
    viewport: { x: 0, y: 0, zoom: 1 }
};

/**
 * 模拟的自定义工作流（带条件分支）
 */
export const mockCustomWorkflow: WorkflowDefinition = {
    id: "custom-conditional",
    name: "条件分支示例",
    description: "根据数据量决定是否跳过预处理",
    nodes: [
        {
            id: "start",
            type: "start",
            position: { x: 100, y: 200 },
            data: { label: "开始" }
        },
        {
            id: "provide-data",
            type: "task",
            position: { x: 300, y: 200 },
            data: {
                label: "提供数据",
                taskType: "ProvideData",
                params: {},
                retryCount: 3,
                timeoutMs: 600000
            }
        },
        {
            id: "condition",
            type: "condition",
            position: { x: 500, y: 200 },
            data: {
                label: "数据量判断",
                conditionExpression: {
                    type: "keyValueMatch",
                    nodeId: "provide-data",
                    key: "recordCount",
                    value: 1000,
                    operator: ">"
                }
            }
        },
        {
            id: "preprocess",
            type: "task",
            position: { x: 700, y: 300 },
            data: {
                label: "预处理",
                taskType: "Preprocess",
                params: {}
            }
        },
        {
            id: "ai-summarize",
            type: "task",
            position: { x: 900, y: 200 },
            data: {
                label: "AI 摘要",
                taskType: "AISummarize",
                params: {}
            }
        },
        {
            id: "end",
            type: "end",
            position: { x: 1100, y: 200 },
            data: { label: "结束" }
        }
    ],
    edges: [
        { id: "e1", source: "start", target: "provide-data" },
        { id: "e2", source: "provide-data", target: "condition" },
        { id: "e3", source: "condition", target: "preprocess", sourceHandle: "false", label: "数据量<1000" },
        { id: "e4", source: "condition", target: "ai-summarize", sourceHandle: "true", label: "数据量>1000" },
        { id: "e5", source: "preprocess", target: "ai-summarize" },
        { id: "e6", source: "ai-summarize", target: "end" }
    ],
    viewport: { x: 0, y: 0, zoom: 1 }
};

/**
 * 模拟的工作流列表
 */
export const mockWorkflows: WorkflowDefinition[] = [mockDefaultWorkflow, mockCustomWorkflow];

/**
 * 模拟的执行历史记录
 */
export const mockExecutions: WorkflowExecution[] = [
    {
        executionId: "exec_20260207_001",
        workflowId: "default-pipeline",
        status: "completed" as WorkflowExecutionStatus,
        nodeStates: {
            start: {
                status: "success" as NodeExecutionStatus,
                startedAt: 1707264000000,
                completedAt: 1707264001000,
                output: {}
            },
            "provide-data": {
                status: "success" as NodeExecutionStatus,
                startedAt: 1707264001000,
                completedAt: 1707264015000,
                output: { recordCount: 1523 }
            },
            preprocess: {
                status: "success" as NodeExecutionStatus,
                startedAt: 1707264015000,
                completedAt: 1707264035000,
                output: { sessionCount: 45 }
            },
            "ai-summarize": {
                status: "success" as NodeExecutionStatus,
                startedAt: 1707264035000,
                completedAt: 1707264125000,
                output: { topicCount: 38 }
            },
            "parallel-start": {
                status: "success" as NodeExecutionStatus,
                startedAt: 1707264125000,
                completedAt: 1707264126000,
                output: {}
            },
            "generate-embedding": {
                status: "success" as NodeExecutionStatus,
                startedAt: 1707264126000,
                completedAt: 1707264180000,
                output: { embeddingCount: 38 }
            },
            "interest-score": {
                status: "success" as NodeExecutionStatus,
                startedAt: 1707264126000,
                completedAt: 1707264175000,
                output: { scoredCount: 38 }
            },
            "parallel-end": {
                status: "success" as NodeExecutionStatus,
                startedAt: 1707264180000,
                completedAt: 1707264181000,
                output: {}
            },
            end: {
                status: "success" as NodeExecutionStatus,
                startedAt: 1707264181000,
                completedAt: 1707264182000,
                output: {}
            }
        },
        startedAt: 1707264000000,
        completedAt: 1707264182000,
        snapshot: mockDefaultWorkflow
    },
    {
        executionId: "exec_20260207_002",
        workflowId: "default-pipeline",
        status: "running" as WorkflowExecutionStatus,
        nodeStates: {
            start: {
                status: "success" as NodeExecutionStatus,
                startedAt: 1707267600000,
                completedAt: 1707267601000,
                output: {}
            },
            "provide-data": {
                status: "success" as NodeExecutionStatus,
                startedAt: 1707267601000,
                completedAt: 1707267612000,
                output: { recordCount: 856 }
            },
            preprocess: {
                status: "success" as NodeExecutionStatus,
                startedAt: 1707267612000,
                completedAt: 1707267628000,
                output: { sessionCount: 28 }
            },
            "ai-summarize": {
                status: "running" as NodeExecutionStatus,
                startedAt: 1707267628000,
                completedAt: undefined,
                output: undefined
            }
        },
        startedAt: 1707267600000,
        completedAt: undefined,
        snapshot: mockDefaultWorkflow
    },
    {
        executionId: "exec_20260206_003",
        workflowId: "default-pipeline",
        status: "failed" as WorkflowExecutionStatus,
        nodeStates: {
            start: {
                status: "success" as NodeExecutionStatus,
                startedAt: 1707177600000,
                completedAt: 1707177601000,
                output: {}
            },
            "provide-data": {
                status: "success" as NodeExecutionStatus,
                startedAt: 1707177601000,
                completedAt: 1707177615000,
                output: { recordCount: 2103 }
            },
            preprocess: {
                status: "failed" as NodeExecutionStatus,
                startedAt: 1707177615000,
                completedAt: 1707177625000,
                output: undefined,
                error: "数据库连接超时"
            }
        },
        startedAt: 1707177600000,
        completedAt: 1707177625000,
        snapshot: mockDefaultWorkflow
    }
];

/**
 * 模拟的实时执行更新事件
 */
export interface ExecutionUpdateEvent {
    type: "nodeStarted" | "nodeCompleted" | "nodeFailed" | "workflowCompleted" | "workflowFailed";
    executionId: string;
    nodeId?: string;
    timestamp: number;
    result?: {
        status: NodeExecutionStatus;
        output?: any;
        error?: string;
        startedAt?: number;
        completedAt?: number;
    };
}

/**
 * 模拟触发工作流执行
 */
export function mockTriggerWorkflow(_workflowId: string, _globalVars?: Record<string, any>) {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
        success: true,
        data: {
            executionId,
            message: "工作流已开始执行"
        }
    };
}

/**
 * 模拟取消工作流执行
 */
export function mockCancelExecution(_executionId: string) {
    return {
        success: true,
        data: {
            message: "工作流已取消"
        }
    };
}

/**
 * 模拟断点续跑
 */
export function mockRetryExecution(executionId: string) {
    return {
        success: true,
        data: {
            executionId: `${executionId}_retry`,
            message: "工作流已从断点继续执行"
        }
    };
}

/**
 * 模拟保存工作流
 */
export function mockSaveWorkflow(_workflow: WorkflowDefinition) {
    return {
        success: true,
        data: {
            message: "工作流已保存"
        }
    };
}

/**
 * 模拟获取工作流列表
 */
export function mockListWorkflows() {
    return {
        success: true,
        data: mockWorkflows
    };
}

/**
 * 模拟获取单个工作流
 */
export function mockGetWorkflow(workflowId: string) {
    const workflow = mockWorkflows.find(w => w.id === workflowId);

    if (!workflow) {
        return {
            success: false,
            message: "工作流不存在"
        };
    }

    return {
        success: true,
        data: workflow
    };
}

/**
 * 模拟获取执行历史
 */
export function mockListExecutions(workflowId?: string, limit: number = 10) {
    let executions = mockExecutions;

    if (workflowId) {
        executions = executions.filter(e => e.workflowId === workflowId);
    }

    return {
        success: true,
        data: executions.slice(0, limit)
    };
}

/**
 * 模拟获取单次执行详情
 */
export function mockGetExecution(executionId: string) {
    const execution = mockExecutions.find(e => e.executionId === executionId);

    if (!execution) {
        return {
            success: false,
            message: "执行记录不存在"
        };
    }

    return {
        success: true,
        data: execution
    };
}

/**
 * 模拟 WebSocket 订阅（返回模拟事件流）
 */
export function* mockExecutionUpdateStream(executionId: string): Generator<ExecutionUpdateEvent> {
    const nodes = ["start", "provide-data", "preprocess", "ai-summarize"];
    let timestamp = Date.now();

    for (const nodeId of nodes) {
        // nodeStarted
        yield {
            type: "nodeStarted",
            executionId,
            nodeId,
            timestamp
        };

        // 模拟节点执行时间（5-15秒）
        timestamp += Math.random() * 10000 + 5000;

        // nodeCompleted
        yield {
            type: "nodeCompleted",
            executionId,
            nodeId,
            timestamp,
            result: {
                status: "success" as NodeExecutionStatus,
                output: { recordCount: Math.floor(Math.random() * 2000) },
                startedAt: timestamp - 10000,
                completedAt: timestamp
            }
        };
    }

    // workflowCompleted
    yield {
        type: "workflowCompleted",
        executionId,
        timestamp: timestamp + 1000
    };
}
