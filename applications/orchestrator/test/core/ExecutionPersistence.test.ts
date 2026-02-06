import type { WorkflowExecution, WorkflowDefinition, NodeState } from "@root/common/contracts/workflow/index";

import path from "node:path";
import * as fs from "node:fs/promises";
import os from "node:os";

import {
    WorkflowExecutionStatus,
    NodeExecutionStatus,
    WorkflowNodeType
} from "@root/common/contracts/workflow/index";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { ExecutionPersistence } from "../../src/core/ExecutionPersistence";

describe("ExecutionPersistence", () => {
    let persistence: ExecutionPersistence;
    let tempDbPath: string;

    /**
     * 创建测试用的工作流定义
     */
    const createMockWorkflowDefinition = (): WorkflowDefinition => {
        return {
            id: "test-workflow",
            name: "测试工作流",
            description: "用于测试的工作流定义",
            nodes: [
                {
                    id: "start",
                    type: WorkflowNodeType.Start,
                    data: {
                        label: "开始"
                    }
                },
                {
                    id: "task1",
                    type: WorkflowNodeType.Task,
                    data: {
                        label: "任务1",
                        taskName: "testTask"
                    }
                },
                {
                    id: "end",
                    type: WorkflowNodeType.End,
                    data: {
                        label: "结束"
                    }
                }
            ],
            edges: [
                { source: "start", target: "task1" },
                { source: "task1", target: "end" }
            ],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
    };

    /**
     * 创建测试用的执行实例
     */
    const createMockExecution = (status: WorkflowExecutionStatus): WorkflowExecution => {
        const snapshot = createMockWorkflowDefinition();
        const nodeStates = new Map<string, NodeState>();

        if (status === WorkflowExecutionStatus.Running) {
            nodeStates.set("start", {
                nodeId: "start",
                status: NodeExecutionStatus.Success
            });
            nodeStates.set("task1", {
                nodeId: "task1",
                status: NodeExecutionStatus.Running
            });
        } else if (status === WorkflowExecutionStatus.Success) {
            nodeStates.set("start", {
                nodeId: "start",
                status: NodeExecutionStatus.Success
            });
            nodeStates.set("task1", {
                nodeId: "task1",
                status: NodeExecutionStatus.Success,
                result: {
                    success: true,
                    output: { data: "test" },
                    startedAt: Date.now(),
                    completedAt: Date.now()
                }
            });
            nodeStates.set("end", {
                nodeId: "end",
                status: NodeExecutionStatus.Success
            });
        }

        return {
            executionId: "test-exec-001",
            workflowId: snapshot.id,
            status,
            nodeStates,
            startedAt: Date.now(),
            completedAt: status === WorkflowExecutionStatus.Success ? Date.now() : undefined,
            snapshot
        };
    };

    beforeEach(async () => {
        // 创建临时数据库目录
        const tempDir = os.tmpdir();
        const tempFolder = path.join(tempDir, `test-workflow-${Date.now()}`);

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

        // 创建 ExecutionPersistence 实例并手动注入依赖
        persistence = new ExecutionPersistence(mockConfigManager as any);

        // 初始化数据库
        await persistence.init();
    });

    afterEach(async () => {
        // 清理资源
        if (persistence) {
            await persistence.dispose();
        }

        // 删除临时数据库文件和目录
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

    it("应该成功保存执行实例到数据库", async () => {
        const execution = createMockExecution(WorkflowExecutionStatus.Running);

        // 保存执行实例
        await persistence.saveExecution(execution);

        // 加载执行实例
        const loaded = await persistence.loadExecution(execution.executionId);

        expect(loaded).not.toBeNull();
        expect(loaded!.executionId).toBe(execution.executionId);
        expect(loaded!.workflowId).toBe(execution.workflowId);
        expect(loaded!.status).toBe(execution.status);
        expect(loaded!.nodeStates.size).toBe(execution.nodeStates.size);
    });

    it("应该支持更新现有执行实例（UPSERT）", async () => {
        const execution = createMockExecution(WorkflowExecutionStatus.Running);

        // 第一次保存
        await persistence.saveExecution(execution);

        // 修改状态后再次保存
        execution.status = WorkflowExecutionStatus.Success;
        execution.completedAt = Date.now();
        execution.nodeStates.set("task1", {
            nodeId: "task1",
            status: NodeExecutionStatus.Success
        });

        await persistence.saveExecution(execution);

        // 加载并验证
        const loaded = await persistence.loadExecution(execution.executionId);

        expect(loaded).not.toBeNull();
        expect(loaded!.status).toBe(WorkflowExecutionStatus.Success);
        expect(loaded!.completedAt).toBeDefined();
        expect(loaded!.nodeStates.get("task1")?.status).toBe(NodeExecutionStatus.Success);
    });

    it("应该正确恢复节点状态（包括 result 字段）", async () => {
        const execution = createMockExecution(WorkflowExecutionStatus.Success);

        // 保存执行实例
        await persistence.saveExecution(execution);

        // 加载执行实例
        const loaded = await persistence.loadExecution(execution.executionId);

        expect(loaded).not.toBeNull();

        const task1State = loaded!.nodeStates.get("task1");

        expect(task1State).toBeDefined();
        expect(task1State!.status).toBe(NodeExecutionStatus.Success);
        expect(task1State!.result).toBeDefined();
        expect(task1State!.result!.success).toBe(true);
        expect(task1State!.result!.output).toEqual({ data: "test" });
    });

    it("查询不存在的执行实例应返回 null", async () => {
        const loaded = await persistence.loadExecution("non-existent-id");

        expect(loaded).toBeNull();
    });

    it("应该正确列举工作流的执行历史", async () => {
        // 创建多个执行实例
        const exec1 = createMockExecution(WorkflowExecutionStatus.Success);

        exec1.executionId = "exec-001";
        exec1.startedAt = Date.now() - 3000;

        const exec2 = createMockExecution(WorkflowExecutionStatus.Running);

        exec2.executionId = "exec-002";
        exec2.startedAt = Date.now() - 2000;

        const exec3 = createMockExecution(WorkflowExecutionStatus.Failed);

        exec3.executionId = "exec-003";
        exec3.startedAt = Date.now() - 1000;

        // 保存执行实例
        await persistence.saveExecution(exec1);
        await persistence.saveExecution(exec2);
        await persistence.saveExecution(exec3);

        // 查询执行历史
        const executions = await persistence.listExecutions("test-workflow", 10);

        expect(executions).toHaveLength(3);

        // 验证按 startedAt 倒序排列
        expect(executions[0].executionId).toBe("exec-003");
        expect(executions[1].executionId).toBe("exec-002");
        expect(executions[2].executionId).toBe("exec-001");
    });

    it("listExecutions 应该支持 limit 参数", async () => {
        // 创建多个执行实例
        for (let i = 0; i < 5; i++) {
            const exec = createMockExecution(WorkflowExecutionStatus.Success);

            exec.executionId = `exec-${i.toString().padStart(3, "0")}`;
            exec.startedAt = Date.now() - (5 - i) * 1000;
            await persistence.saveExecution(exec);
        }

        // 查询前 2 条记录
        const executions = await persistence.listExecutions("test-workflow", 2);

        expect(executions).toHaveLength(2);
        expect(executions[0].executionId).toBe("exec-004");
        expect(executions[1].executionId).toBe("exec-003");
    });

    it("删除执行记录应同时删除关联的节点状态（级联删除）", async () => {
        const execution = createMockExecution(WorkflowExecutionStatus.Success);

        // 保存执行实例
        await persistence.saveExecution(execution);

        // 确认已保存
        const loaded = await persistence.loadExecution(execution.executionId);

        expect(loaded).not.toBeNull();
        expect(loaded!.nodeStates.size).toBeGreaterThan(0);

        // 手动删除执行记录（模拟清理操作）
        await (persistence as any).db.run("DELETE FROM workflow_executions WHERE executionId = ?", [
            execution.executionId
        ]);

        // 确认节点状态也被删除（级联删除）
        const nodeStates = await (persistence as any).db.all(
            "SELECT * FROM workflow_node_states WHERE executionId = ?",
            [execution.executionId]
        );

        expect(nodeStates).toHaveLength(0);
    });
});
