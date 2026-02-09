import type { WorkflowDefinition, NodeExecutionResult } from "@root/common/contracts/workflow/index";

import path from "node:path";
import * as fs from "node:fs/promises";
import os from "node:os";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WorkflowNodeType, NodeExecutionStatus } from "@root/common/contracts/workflow/index";
import { ExecutionContext } from "@root/common/scheduler/helpers/ExecutionContext";

import { ExecutionPersistence } from "../../core/ExecutionPersistence";
import { WorkflowExecutor } from "../../core/WorkflowExecutor";
import { INodeExecutorAdapter } from "../../adapters/INodeExecutorAdapter";

/**
 * 测试专用的节点执行器适配器
 * 可模拟任务执行成功或失败
 */
class TestNodeExecutorAdapter implements INodeExecutorAdapter {
    private _failingNodes: Set<string> = new Set();

    /**
     * 设置哪些节点应该失败
     */
    public setFailingNodes(nodeIds: string[]): void {
        this._failingNodes = new Set(nodeIds);
    }

    public async executeTaskNode(
        nodeId: string,
        taskType: string,
        params: Record<string, any>,
        context: ExecutionContext
    ): Promise<NodeExecutionResult> {
        if (this._failingNodes.has(nodeId)) {
            return {
                success: false,
                error: `节点 ${nodeId} 模拟失败`,
                startedAt: Date.now(),
                completedAt: Date.now()
            };
        }

        return {
            success: true,
            output: { nodeId, taskType, data: "test" },
            startedAt: Date.now(),
            completedAt: Date.now()
        };
    }

    public async executeScriptNode(
        nodeId: string,
        script: string,
        context: ExecutionContext
    ): Promise<NodeExecutionResult> {
        return {
            success: true,
            output: { result: "script executed" },
            startedAt: Date.now(),
            completedAt: Date.now()
        };
    }

    public async executeHttpNode(
        nodeId: string,
        config: any,
        context: ExecutionContext
    ): Promise<NodeExecutionResult> {
        return {
            success: true,
            output: { status: 200, data: "ok" },
            startedAt: Date.now(),
            completedAt: Date.now()
        };
    }
}

describe("WorkflowExecutor 断点续跑集成测试", () => {
    let persistence: ExecutionPersistence;
    let adapter: TestNodeExecutorAdapter;
    let tempDbPath: string;

    /**
     * 创建测试工作流定义
     */
    const createWorkflowDefinition = (): WorkflowDefinition => {
        return {
            id: "checkpoint-test-workflow",
            name: "断点续跑测试工作流",
            description: "用于测试断点续跑功能",
            nodes: [
                {
                    id: "start",
                    type: WorkflowNodeType.Start,
                    data: { label: "开始" }
                },
                {
                    id: "task1",
                    type: WorkflowNodeType.Task,
                    data: { label: "任务1", taskType: "test.task1" }
                },
                {
                    id: "task2",
                    type: WorkflowNodeType.Task,
                    data: { label: "任务2", taskType: "test.task2" }
                },
                {
                    id: "task3",
                    type: WorkflowNodeType.Task,
                    data: { label: "任务3", taskType: "test.task3" }
                },
                {
                    id: "end",
                    type: WorkflowNodeType.End,
                    data: { label: "结束" }
                }
            ],
            edges: [
                { source: "start", target: "task1" },
                { source: "task1", target: "task2" },
                { source: "task2", target: "task3" },
                { source: "task3", target: "end" }
            ],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
    };

    beforeEach(async () => {
        // 创建临时数据库目录
        const tempDir = os.tmpdir();
        const tempFolder = path.join(tempDir, `test-checkpoint-${Date.now()}`);

        await fs.mkdir(tempFolder, { recursive: true });
        tempDbPath = path.join(tempFolder, "synthos_workflow_executions.db");

        // 创建 Mock ConfigManagerService
        const mockConfigManager = {
            getCurrentConfig: async () => ({
                commonDatabase: {
                    dbBasePath: tempFolder
                }
            })
        };

        // 创建服务实例
        persistence = new ExecutionPersistence(mockConfigManager as any);
        await persistence.init();

        adapter = new TestNodeExecutorAdapter();
    });

    afterEach(async () => {
        // 清理资源
        if (persistence) {
            await persistence.dispose();
        }

        // 删除临时文件
        try {
            if (tempDbPath) {
                await fs.unlink(tempDbPath);
                const tempDir = path.dirname(tempDbPath);

                await fs.rmdir(tempDir);
            }
        } catch (error) {
            // 忽略清理错误
        }
    });

    it("应该能够从中断点恢复执行（task2 失败后重新执行）", async () => {
        const workflowDef = createWorkflowDefinition();
        const executionId = "checkpoint-exec-001";

        // 第一次执行：task2 会失败
        adapter.setFailingNodes(["task2"]);

        const executor1 = new WorkflowExecutor(workflowDef, executionId, adapter, persistence);

        const result1 = await executor1.execute(false); // 不恢复，从头开始

        // 验证执行失败
        expect(result1.status).toBe("failed");

        // 验证 task1 成功，task2 失败，task3 未执行
        expect(result1.nodeStates.get("start")?.status).toBe(NodeExecutionStatus.Success);
        expect(result1.nodeStates.get("task1")?.status).toBe(NodeExecutionStatus.Success);
        expect(result1.nodeStates.get("task2")?.status).toBe(NodeExecutionStatus.Failed);
        expect(result1.nodeStates.get("task3")?.status).toBe(NodeExecutionStatus.Cancelled);

        // 第二次执行：修复问题，task2 不再失败
        adapter.setFailingNodes([]); // 清空失败节点

        const executor2 = new WorkflowExecutor(workflowDef, executionId, adapter, persistence);

        const result2 = await executor2.execute(true); // 从断点恢复

        // 验证执行成功
        expect(result2.status).toBe("success");

        // 验证所有节点成功
        expect(result2.nodeStates.get("start")?.status).toBe(NodeExecutionStatus.Success);
        expect(result2.nodeStates.get("task1")?.status).toBe(NodeExecutionStatus.Success);
        expect(result2.nodeStates.get("task2")?.status).toBe(NodeExecutionStatus.Success);
        expect(result2.nodeStates.get("task3")?.status).toBe(NodeExecutionStatus.Success);
        expect(result2.nodeStates.get("end")?.status).toBe(NodeExecutionStatus.Success);

        // 验证数据库中保存的状态
        const savedExecution = await persistence.loadExecution(executionId);

        expect(savedExecution).not.toBeNull();
        expect(savedExecution!.status).toBe("success");
        expect(savedExecution!.nodeStates.size).toBe(5);
    });

    it("应该跳过已完成的节点，只执行未完成的节点", async () => {
        const workflowDef = createWorkflowDefinition();
        const executionId = "checkpoint-exec-002";

        // 第一次执行：让所有节点都成功
        const executor1 = new WorkflowExecutor(workflowDef, executionId, adapter, persistence);

        await executor1.execute(false);

        // 记录第一次执行的 task1 结果
        const task1Result1 = executor1.getExecutionContext().getNodeResult("task1");

        // 第二次执行：尝试断点续跑（所有节点已完成）
        const executor2 = new WorkflowExecutor(workflowDef, executionId, adapter, persistence);

        await executor2.execute(true);

        // 验证 task1 的结果未改变（没有重新执行）
        const task1Result2 = executor2.getExecutionContext().getNodeResult("task1");

        expect(task1Result2).toEqual(task1Result1);
    });
});
