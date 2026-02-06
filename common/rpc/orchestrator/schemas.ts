/**
 * Orchestrator RPC Schemas
 * 定义 Orchestrator RPC 接口的输入/输出类型
 */
import { z } from "zod";

import {
    WorkflowDefinitionSchema,
    WorkflowExecutionStatus,
    NodeExecutionStatus
} from "../../contracts/workflow/index";

// ========== listWorkflows 接口 ==========

export const ListWorkflowsOutputSchema = z.array(
    z.object({
        id: z.string(),
        name: z.string(),
        description: z.string()
    })
);

export type ListWorkflowsOutput = z.infer<typeof ListWorkflowsOutputSchema>;

// ========== getWorkflow 接口 ==========

export const GetWorkflowInputSchema = z.object({
    id: z.string().min(1, "工作流 ID 不能为空")
});

export const GetWorkflowOutputSchema = WorkflowDefinitionSchema;

export type GetWorkflowInput = z.infer<typeof GetWorkflowInputSchema>;
export type GetWorkflowOutput = z.infer<typeof GetWorkflowOutputSchema>;

// ========== triggerWorkflow 接口 ==========

export const TriggerWorkflowInputSchema = z.object({
    workflowId: z.string().min(1, "工作流 ID 不能为空"),
    globalVars: z.record(z.any()).optional()
});

export const TriggerWorkflowOutputSchema = z.object({
    success: z.boolean(),
    executionId: z.string().optional(),
    message: z.string()
});

export type TriggerWorkflowInput = z.infer<typeof TriggerWorkflowInputSchema>;
export type TriggerWorkflowOutput = z.infer<typeof TriggerWorkflowOutputSchema>;

// ========== cancelExecution 接口 ==========

export const CancelExecutionInputSchema = z.object({
    executionId: z.string().min(1, "执行 ID 不能为空")
});

export const CancelExecutionOutputSchema = z.object({
    success: z.boolean(),
    message: z.string()
});

export type CancelExecutionInput = z.infer<typeof CancelExecutionInputSchema>;
export type CancelExecutionOutput = z.infer<typeof CancelExecutionOutputSchema>;

// ========== retryExecution 接口 ==========

export const RetryExecutionInputSchema = z.object({
    executionId: z.string().min(1, "执行 ID 不能为空")
});

export const RetryExecutionOutputSchema = z.object({
    success: z.boolean(),
    newExecutionId: z.string().optional(),
    message: z.string()
});

export type RetryExecutionInput = z.infer<typeof RetryExecutionInputSchema>;
export type RetryExecutionOutput = z.infer<typeof RetryExecutionOutputSchema>;

// ========== listExecutions 接口 ==========

export const ListExecutionsInputSchema = z.object({
    workflowId: z.string().min(1, "工作流 ID 不能为空"),
    limit: z.number().int().positive().default(50)
});

export const ExecutionSummarySchema = z.object({
    executionId: z.string(),
    workflowId: z.string(),
    status: z.nativeEnum(WorkflowExecutionStatus),
    startedAt: z.number(),
    completedAt: z.number().optional(),
    progress: z.object({
        total: z.number(),
        completed: z.number(),
        failed: z.number(),
        running: z.number()
    })
});

export const ListExecutionsOutputSchema = z.array(ExecutionSummarySchema);

export type ListExecutionsInput = z.infer<typeof ListExecutionsInputSchema>;
export type ListExecutionsOutput = z.infer<typeof ListExecutionsOutputSchema>;
export type ExecutionSummary = z.infer<typeof ExecutionSummarySchema>;

// ========== getExecution 接口 ==========

export const GetExecutionInputSchema = z.object({
    executionId: z.string().min(1, "执行 ID 不能为空")
});

export const NodeStateSchema = z.object({
    nodeId: z.string(),
    status: z.nativeEnum(NodeExecutionStatus),
    result: z
        .object({
            success: z.boolean(),
            output: z.any().optional(),
            error: z.string().optional(),
            startedAt: z.number(),
            completedAt: z.number()
        })
        .optional()
});

export const GetExecutionOutputSchema = z.object({
    executionId: z.string(),
    workflowId: z.string(),
    status: z.nativeEnum(WorkflowExecutionStatus),
    nodeStates: z.array(NodeStateSchema),
    startedAt: z.number(),
    completedAt: z.number().optional(),
    snapshot: WorkflowDefinitionSchema
});

export type GetExecutionInput = z.infer<typeof GetExecutionInputSchema>;
export type GetExecutionOutput = z.infer<typeof GetExecutionOutputSchema>;
export type NodeStateDTO = z.infer<typeof NodeStateSchema>;

// ========== onExecutionUpdate 订阅接口 ==========

export const OnExecutionUpdateInputSchema = z.object({
    executionId: z.string().min(1, "执行 ID 不能为空")
});

export const ExecutionUpdateEventSchema = z.object({
    type: z.enum(["nodeStarted", "nodeCompleted", "nodeFailed", "executionCompleted", "executionFailed"]),
    executionId: z.string(),
    nodeId: z.string().optional(),
    nodeState: NodeStateSchema.optional(),
    timestamp: z.number()
});

export type OnExecutionUpdateInput = z.infer<typeof OnExecutionUpdateInputSchema>;
export type ExecutionUpdateEvent = z.infer<typeof ExecutionUpdateEventSchema>;
