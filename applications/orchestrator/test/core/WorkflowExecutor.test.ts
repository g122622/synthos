import { describe, it, expect, beforeEach } from "vitest";
import {
    WorkflowDefinition,
    WorkflowNodeType,
    NodeExecutionResult,
    NodeExecutionStatus,
    WorkflowExecutionStatus
} from "@root/common/contracts/workflow/index";
import { TaskHandlerTypes } from "@root/common/scheduler/@types/Tasks";

import { WorkflowExecutor } from "../../src/core/WorkflowExecutor";
import { NodeExecutorAdapter } from "../../src/adapters/NodeExecutorAdapter";
import { ExecutionContext } from "../../src/core/ExecutionContext";

/**
 * Mock 节点执行器适配器（用于测试）
 */
class MockNodeExecutorAdapter implements NodeExecutorAdapter {
    private _taskResults: Map<string, NodeExecutionResult> = new Map();
    private _executionDelay: number = 0;

    /**
     * 设置任务节点的执行结果
     */
    public setTaskResult(taskType: string, result: NodeExecutionResult): void {
        this._taskResults.set(taskType, result);
    }

    /**
     * 设置执行延迟（模拟异步执行）
     */
    public setExecutionDelay(delayMs: number): void {
        this._executionDelay = delayMs;
    }

    public async executeTaskNode(
        nodeId: string,
        taskType: string,
        params: Record<string, any>,
        context: ExecutionContext
    ): Promise<NodeExecutionResult> {
        if (this._executionDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, this._executionDelay));
        }

        const result = this._taskResults.get(taskType);

        if (result) {
            return result;
        }

        // 默认成功
        return {
            success: true,
            output: { taskType, params },
            startedAt: Date.now(),
            completedAt: Date.now()
        };
    }

    public async executeScriptNode(
        nodeId: string,
        scriptCode: string,
        context: ExecutionContext
    ): Promise<NodeExecutionResult> {
        if (this._executionDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, this._executionDelay));
        }

        return {
            success: true,
            output: { scriptCode },
            startedAt: Date.now(),
            completedAt: Date.now()
        };
    }

    public async executeHttpNode(
        nodeId: string,
        httpConfig: any,
        context: ExecutionContext
    ): Promise<NodeExecutionResult> {
        if (this._executionDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, this._executionDelay));
        }

        return {
            success: true,
            output: { httpConfig },
            startedAt: Date.now(),
            completedAt: Date.now()
        };
    }
}

describe("WorkflowExecutor", () => {
    let mockAdapter: MockNodeExecutorAdapter;

    beforeEach(() => {
        mockAdapter = new MockNodeExecutorAdapter();
    });

    describe("基本执行流程", () => {
        it("应该成功执行简单的线性工作流", async () => {
            const workflow: WorkflowDefinition = {
                id: "wf-1",
                name: "简单线性工作流",
                description: "测试简单线性流程",
                nodes: [
                    {
                        id: "start",
                        type: WorkflowNodeType.Start,
                        position: { x: 0, y: 0 },
                        data: { label: "开始" }
                    },
                    {
                        id: "task1",
                        type: WorkflowNodeType.Task,
                        position: { x: 100, y: 0 },
                        data: { label: "任务1", taskType: TaskHandlerTypes.ProvideData }
                    },
                    {
                        id: "task2",
                        type: WorkflowNodeType.Task,
                        position: { x: 200, y: 0 },
                        data: { label: "任务2", taskType: TaskHandlerTypes.Preprocess }
                    },
                    {
                        id: "end",
                        type: WorkflowNodeType.End,
                        position: { x: 300, y: 0 },
                        data: { label: "结束" }
                    }
                ],
                edges: [
                    { id: "e1", source: "start", target: "task1" },
                    { id: "e2", source: "task1", target: "task2" },
                    { id: "e3", source: "task2", target: "end" }
                ]
            };

            const executor = new WorkflowExecutor(workflow, "exec-1", mockAdapter);
            const execution = await executor.execute();

            expect(execution.status).toBe(WorkflowExecutionStatus.Success);
            expect(execution.nodeStates.size).toBe(4);

            // 检查所有节点状态
            expect(execution.nodeStates.get("start")?.status).toBe(NodeExecutionStatus.Success);
            expect(execution.nodeStates.get("task1")?.status).toBe(NodeExecutionStatus.Success);
            expect(execution.nodeStates.get("task2")?.status).toBe(NodeExecutionStatus.Success);
            expect(execution.nodeStates.get("end")?.status).toBe(NodeExecutionStatus.Success);
        });

        it("应该正确执行并行分支", async () => {
            const workflow: WorkflowDefinition = {
                id: "wf-2",
                name: "并行工作流",
                description: "测试并行分支",
                nodes: [
                    {
                        id: "start",
                        type: WorkflowNodeType.Start,
                        position: { x: 0, y: 0 },
                        data: { label: "开始" }
                    },
                    {
                        id: "task1",
                        type: WorkflowNodeType.Task,
                        position: { x: 100, y: 0 },
                        data: { label: "任务1", taskType: TaskHandlerTypes.AISummarize }
                    },
                    {
                        id: "task2",
                        type: WorkflowNodeType.Task,
                        position: { x: 100, y: 100 },
                        data: { label: "任务2", taskType: TaskHandlerTypes.GenerateEmbedding }
                    },
                    {
                        id: "end",
                        type: WorkflowNodeType.End,
                        position: { x: 200, y: 50 },
                        data: { label: "结束" }
                    }
                ],
                edges: [
                    { id: "e1", source: "start", target: "task1" },
                    { id: "e2", source: "start", target: "task2" },
                    { id: "e3", source: "task1", target: "end" },
                    { id: "e4", source: "task2", target: "end" }
                ]
            };

            // 设置执行延迟，模拟异步
            mockAdapter.setExecutionDelay(50);

            const executor = new WorkflowExecutor(workflow, "exec-2", mockAdapter);
            const startTime = Date.now();
            const execution = await executor.execute();
            const endTime = Date.now();

            expect(execution.status).toBe(WorkflowExecutionStatus.Success);

            // 检查所有节点状态
            expect(execution.nodeStates.get("start")?.status).toBe(NodeExecutionStatus.Success);
            expect(execution.nodeStates.get("task1")?.status).toBe(NodeExecutionStatus.Success);
            expect(execution.nodeStates.get("task2")?.status).toBe(NodeExecutionStatus.Success);
            expect(execution.nodeStates.get("end")?.status).toBe(NodeExecutionStatus.Success);

            // 验证并行执行（总时间应该小于串行执行的时间）
            // 串行执行需要 150ms（3层 × 50ms），并行应该 < 150ms
            const totalTime = endTime - startTime;

            expect(totalTime).toBeLessThan(150);
        });
    });

    describe("失败处理", () => {
        it("应该在节点失败时终止流程（skipOnFailure=false）", async () => {
            const workflow: WorkflowDefinition = {
                id: "wf-3",
                name: "失败测试",
                description: "测试节点失败",
                nodes: [
                    {
                        id: "start",
                        type: WorkflowNodeType.Start,
                        position: { x: 0, y: 0 },
                        data: { label: "开始" }
                    },
                    {
                        id: "task1",
                        type: WorkflowNodeType.Task,
                        position: { x: 100, y: 0 },
                        data: {
                            label: "任务1（失败）",
                            taskType: TaskHandlerTypes.ProvideData,
                            skipOnFailure: false
                        }
                    },
                    {
                        id: "task2",
                        type: WorkflowNodeType.Task,
                        position: { x: 200, y: 0 },
                        data: { label: "任务2", taskType: TaskHandlerTypes.Preprocess }
                    },
                    {
                        id: "end",
                        type: WorkflowNodeType.End,
                        position: { x: 300, y: 0 },
                        data: { label: "结束" }
                    }
                ],
                edges: [
                    { id: "e1", source: "start", target: "task1" },
                    { id: "e2", source: "task1", target: "task2" },
                    { id: "e3", source: "task2", target: "end" }
                ]
            };

            // 设置 task1 失败
            mockAdapter.setTaskResult(TaskHandlerTypes.ProvideData, {
                success: false,
                error: "模拟失败",
                startedAt: Date.now(),
                completedAt: Date.now()
            });

            const executor = new WorkflowExecutor(workflow, "exec-3", mockAdapter);
            const execution = await executor.execute();

            expect(execution.status).toBe(WorkflowExecutionStatus.Failed);
            expect(execution.nodeStates.get("task1")?.status).toBe(NodeExecutionStatus.Failed);

            // task2 应该被取消
            expect(execution.nodeStates.get("task2")?.status).toBe(NodeExecutionStatus.Cancelled);
        });

        it("应该在节点失败时跳过并继续（skipOnFailure=true）", async () => {
            const workflow: WorkflowDefinition = {
                id: "wf-4",
                name: "跳过失败测试",
                description: "测试 skipOnFailure",
                nodes: [
                    {
                        id: "start",
                        type: WorkflowNodeType.Start,
                        position: { x: 0, y: 0 },
                        data: { label: "开始" }
                    },
                    {
                        id: "task1",
                        type: WorkflowNodeType.Task,
                        position: { x: 100, y: 0 },
                        data: {
                            label: "任务1（失败但跳过）",
                            taskType: TaskHandlerTypes.ProvideData,
                            skipOnFailure: true
                        }
                    },
                    {
                        id: "task2",
                        type: WorkflowNodeType.Task,
                        position: { x: 200, y: 0 },
                        data: { label: "任务2", taskType: TaskHandlerTypes.Preprocess }
                    },
                    {
                        id: "end",
                        type: WorkflowNodeType.End,
                        position: { x: 300, y: 0 },
                        data: { label: "结束" }
                    }
                ],
                edges: [
                    { id: "e1", source: "start", target: "task1" },
                    { id: "e2", source: "task1", target: "task2" },
                    { id: "e3", source: "task2", target: "end" }
                ]
            };

            // 设置 task1 失败
            mockAdapter.setTaskResult(TaskHandlerTypes.ProvideData, {
                success: false,
                error: "模拟失败",
                startedAt: Date.now(),
                completedAt: Date.now()
            });

            const executor = new WorkflowExecutor(workflow, "exec-4", mockAdapter);
            const execution = await executor.execute();

            expect(execution.status).toBe(WorkflowExecutionStatus.Success);
            expect(execution.nodeStates.get("task1")?.status).toBe(NodeExecutionStatus.Failed);
            expect(execution.nodeStates.get("task2")?.status).toBe(NodeExecutionStatus.Success);
            expect(execution.nodeStates.get("end")?.status).toBe(NodeExecutionStatus.Success);
        });
    });

    describe("事件发射", () => {
        it("应该发射 executionStarted 和 executionCompleted 事件", async () => {
            const workflow: WorkflowDefinition = {
                id: "wf-5",
                name: "事件测试",
                description: "测试事件发射",
                nodes: [
                    {
                        id: "start",
                        type: WorkflowNodeType.Start,
                        position: { x: 0, y: 0 },
                        data: { label: "开始" }
                    },
                    {
                        id: "end",
                        type: WorkflowNodeType.End,
                        position: { x: 100, y: 0 },
                        data: { label: "结束" }
                    }
                ],
                edges: [{ id: "e1", source: "start", target: "end" }]
            };

            const executor = new WorkflowExecutor(workflow, "exec-5", mockAdapter);

            const events: string[] = [];

            executor.on("executionStarted", () => events.push("started"));
            executor.on("executionCompleted", () => events.push("completed"));
            executor.on("nodeStarted", () => events.push("nodeStarted"));
            executor.on("nodeCompleted", () => events.push("nodeCompleted"));

            await executor.execute();

            expect(events).toContain("started");
            expect(events).toContain("completed");
            expect(events).toContain("nodeStarted");
            expect(events).toContain("nodeCompleted");
        });

        it("应该发射 nodeFailed 和 executionFailed 事件", async () => {
            const workflow: WorkflowDefinition = {
                id: "wf-6",
                name: "失败事件测试",
                description: "测试失败事件",
                nodes: [
                    {
                        id: "start",
                        type: WorkflowNodeType.Start,
                        position: { x: 0, y: 0 },
                        data: { label: "开始" }
                    },
                    {
                        id: "task1",
                        type: WorkflowNodeType.Task,
                        position: { x: 100, y: 0 },
                        data: { label: "失败任务", taskType: TaskHandlerTypes.ProvideData, skipOnFailure: false }
                    },
                    {
                        id: "end",
                        type: WorkflowNodeType.End,
                        position: { x: 200, y: 0 },
                        data: { label: "结束" }
                    }
                ],
                edges: [
                    { id: "e1", source: "start", target: "task1" },
                    { id: "e2", source: "task1", target: "end" }
                ]
            };

            // 设置失败
            mockAdapter.setTaskResult(TaskHandlerTypes.ProvideData, {
                success: false,
                error: "测试失败",
                startedAt: Date.now(),
                completedAt: Date.now()
            });

            const executor = new WorkflowExecutor(workflow, "exec-6", mockAdapter);

            const events: string[] = [];

            executor.on("nodeFailed", () => events.push("nodeFailed"));
            executor.on("executionFailed", () => events.push("executionFailed"));

            await executor.execute();

            expect(events).toContain("nodeFailed");
            expect(events).toContain("executionFailed");
        });
    });

    describe("执行上下文", () => {
        it("应该正确保存和传递节点执行结果", async () => {
            const workflow: WorkflowDefinition = {
                id: "wf-7",
                name: "上下文测试",
                description: "测试执行上下文",
                nodes: [
                    {
                        id: "start",
                        type: WorkflowNodeType.Start,
                        position: { x: 0, y: 0 },
                        data: { label: "开始" }
                    },
                    {
                        id: "task1",
                        type: WorkflowNodeType.Task,
                        position: { x: 100, y: 0 },
                        data: { label: "任务1", taskType: TaskHandlerTypes.ProvideData }
                    },
                    {
                        id: "end",
                        type: WorkflowNodeType.End,
                        position: { x: 200, y: 0 },
                        data: { label: "结束" }
                    }
                ],
                edges: [
                    { id: "e1", source: "start", target: "task1" },
                    { id: "e2", source: "task1", target: "end" }
                ]
            };

            const executor = new WorkflowExecutor(workflow, "exec-7", mockAdapter);

            await executor.execute();

            const context = executor.getExecutionContext();

            // 检查节点结果
            expect(context.getNodeResult("start")).toBeDefined();
            expect(context.getNodeResult("task1")).toBeDefined();
            expect(context.getNodeResult("end")).toBeDefined();

            // 检查节点状态
            expect(context.isNodeSuccess("start")).toBe(true);
            expect(context.isNodeSuccess("task1")).toBe(true);
            expect(context.isNodeSuccess("end")).toBe(true);
        });
    });
});
