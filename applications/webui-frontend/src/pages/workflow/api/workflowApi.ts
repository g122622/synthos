/**
 * 工作流 API 服务
 *
 * 与后端 webui-backend 通信，实现工作流的增删改查
 */

import type { WorkflowDefinition, WorkflowExecution, ExecutionSummary } from "../types/index";

const API_BASE = "/api/workflow";

/**
 * 获取所有工作流列表
 */
export async function fetchWorkflows(): Promise<WorkflowDefinition[]> {
    const response = await fetch(`${API_BASE}/list`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        throw new Error(`获取工作流列表失败: ${response.statusText}`);
    }

    return response.json();
}

/**
 * 获取指定工作流定义
 */
export async function fetchWorkflowById(id: string): Promise<WorkflowDefinition> {
    const response = await fetch(`${API_BASE}/${id}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        throw new Error(`获取工作流失败: ${response.statusText}`);
    }

    return response.json();
}

/**
 * 保存工作流定义
 *
 * @param workflow - 工作流定义对象
 * @returns 保存后的工作流（包含 id 和更新时间）
 */
export async function saveWorkflow(workflow: WorkflowDefinition): Promise<WorkflowDefinition> {
    const response = await fetch(`${API_BASE}/save`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(workflow)
    });

    if (!response.ok) {
        throw new Error(`保存工作流失败: ${response.statusText}`);
    }

    return response.json();
}

/**
 * 删除工作流
 */
export async function deleteWorkflow(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/${id}`, {
        method: "DELETE"
    });

    if (!response.ok) {
        throw new Error(`删除工作流失败: ${response.statusText}`);
    }
}

/**
 * 手动触发工作流执行
 *
 * @param workflowId - 工作流 ID
 * @returns 执行 ID
 */
export async function triggerWorkflow(workflowId: string): Promise<string> {
    const response = await fetch(`${API_BASE}/execute/${workflowId}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        throw new Error(`触发工作流失败: ${response.statusText}`);
    }

    const result = await response.json();

    return result.executionId;
}

/**
 * 取消正在执行的工作流
 *
 * @param executionId - 执行 ID
 */
export async function cancelExecution(executionId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/execution/${executionId}/cancel`, {
        method: "POST"
    });

    if (!response.ok) {
        throw new Error(`取消执行失败: ${response.statusText}`);
    }
}

/**
 * 从断点处继续执行工作流
 *
 * @param executionId - 执行 ID
 */
export async function resumeExecution(executionId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/execution/${executionId}/resume`, {
        method: "POST"
    });

    if (!response.ok) {
        throw new Error(`断点续跑失败: ${response.statusText}`);
    }
}

/**
 * 获取工作流执行历史（摘要列表）
 *
 * @param workflowId - 工作流 ID
 * @param page - 页码（从 1 开始）
 * @param pageSize - 每页数量
 * @returns 执行历史摘要列表和总数
 */
export async function fetchExecutionHistory(workflowId: string, page: number = 1, pageSize: number = 50): Promise<{ executions: ExecutionSummary[]; total: number }> {
    const response = await fetch(`${API_BASE}/executions?workflowId=${workflowId}&page=${page}&pageSize=${pageSize}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        throw new Error(`获取执行历史失败: ${response.statusText}`);
    }

    return response.json();
}

/**
 * 获取单次执行的完整信息（包括快照和节点状态）
 *
 * @param executionId - 执行 ID
 * @returns 完整的执行信息
 */
export async function fetchExecutionById(executionId: string): Promise<WorkflowExecution> {
    const response = await fetch(`${API_BASE}/execution/${executionId}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        throw new Error(`获取执行详情失败: ${response.statusText}`);
    }

    return response.json();
}
