import { beforeEach, describe, expect, it } from "vitest";
import {
    NodeExecutionResult,
    NodeExecutionStatus,
    WorkflowDefinition,
    WorkflowExecutionStatus,
    WorkflowNodeType
} from "@root/common/contracts/workflow/index";
import { ExecutionContext } from "@root/common/scheduler/helpers/ExecutionContext";

import { INodeExecutorAdapter } from "../../adapters/INodeExecutorAdapter";
import { WorkflowExecutor } from "../../core/WorkflowExecutor";

class MockNodeExecutorAdapter implements INodeExecutorAdapter {
    private _taskResults: Map<string, NodeExecutionResult>;
    private _taskDelays: Map<string, number>;
    private _taskStartTimes: Map<string, number>;
    private _taskEndTimes: Map<string, number>;
    private _executedTasks: Array<{ nodeId: string; taskType: string }>;

    public constructor() {
        this._taskResults = new Map();
        this._taskDelays = new Map();
        this._taskStartTimes = new Map();
        this._taskEndTimes = new Map();
        this._executedTasks = [];
    }

    public setTaskResult(taskType: string, result: NodeExecutionResult): void {
        this._taskResults.set(taskType, result);
    }

    public setTaskDelay(taskType: string, delayMs: number): void {
        this._taskDelays.set(taskType, delayMs);
    }

    public getTaskStartTime(nodeId: string): number | undefined {
        return this._taskStartTimes.get(nodeId);
    }

    public getTaskEndTime(nodeId: string): number | undefined {
        return this._taskEndTimes.get(nodeId);
    }

    public getExecutedTasks(): Array<{ nodeId: string; taskType: string }> {
        return [...this._executedTasks];
    }

    public async executeTaskNode(
        nodeId: string,
        taskType: string,
        params: Record<string, any>,
        context: ExecutionContext
    ): Promise<NodeExecutionResult> {
        void context;
        const delayMs = this._taskDelays.get(taskType) ?? 0;

        this._executedTasks.push({ nodeId, taskType });
        this._taskStartTimes.set(nodeId, Date.now());

        if (delayMs > 0) {
            await new Promise<void>(resolve => {
                setTimeout(() => resolve(), delayMs);
            });
        }

        const predefined = this._taskResults.get(taskType);

        const result: NodeExecutionResult = predefined ?? {
            success: true,
            output: { taskType, params },
            startedAt: Date.now(),
            completedAt: Date.now()
        };

        this._taskEndTimes.set(nodeId, Date.now());

        return result;
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
                id: "wf-linear",
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
                        data: { label: "任务1", taskType: "ProvideData" }
                    },
                    {
                        id: "task2",
                        type: WorkflowNodeType.Task,
                        position: { x: 200, y: 0 },
                        data: { label: "任务2", taskType: "Preprocess" }
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

            const executor = new WorkflowExecutor(workflow, "exec-linear", mockAdapter);
            const execution = await executor.execute();

            expect(execution.status).toBe(WorkflowExecutionStatus.Success);

            expect(execution.nodeStates.get("start")?.status).toBe(NodeExecutionStatus.Success);
            expect(execution.nodeStates.get("task1")?.status).toBe(NodeExecutionStatus.Success);
            expect(execution.nodeStates.get("task2")?.status).toBe(NodeExecutionStatus.Success);
            expect(execution.nodeStates.get("end")?.status).toBe(NodeExecutionStatus.Success);

            expect(mockAdapter.getExecutedTasks()).toEqual([
                { nodeId: "task1", taskType: "ProvideData" },
                { nodeId: "task2", taskType: "Preprocess" }
            ]);
        });

        it("应该并行执行同一层的多个任务节点", async () => {
            const workflow: WorkflowDefinition = {
                id: "wf-parallel",
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
                        data: { label: "任务1", taskType: "AISummarize" }
                    },
                    {
                        id: "task2",
                        type: WorkflowNodeType.Task,
                        position: { x: 100, y: 100 },
                        data: { label: "任务2", taskType: "GenerateEmbedding" }
                    },
                    {
                        id: "end",
                        type: WorkflowNodeType.End,
                        position: { x: 250, y: 50 },
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

            mockAdapter.setTaskDelay("AISummarize", 80);
            mockAdapter.setTaskDelay("GenerateEmbedding", 80);

            const executor = new WorkflowExecutor(workflow, "exec-parallel", mockAdapter);
            const execution = await executor.execute();

            expect(execution.status).toBe(WorkflowExecutionStatus.Success);
            expect(execution.nodeStates.get("task1")?.status).toBe(NodeExecutionStatus.Success);
            expect(execution.nodeStates.get("task2")?.status).toBe(NodeExecutionStatus.Success);

            const task1StartedAt = mockAdapter.getTaskStartTime("task1");
            const task1EndedAt = mockAdapter.getTaskEndTime("task1");
            const task2StartedAt = mockAdapter.getTaskStartTime("task2");
            const task2EndedAt = mockAdapter.getTaskEndTime("task2");

            expect(task1StartedAt).toBeTypeOf("number");
            expect(task1EndedAt).toBeTypeOf("number");
            expect(task2StartedAt).toBeTypeOf("number");
            expect(task2EndedAt).toBeTypeOf("number");

            const overlapped =
                (task1StartedAt as number) < (task2EndedAt as number) &&
                (task2StartedAt as number) < (task1EndedAt as number);

            expect(overlapped).toBe(true);
        });
    });

    describe("失败处理", () => {
        it("应该在节点失败且 skipOnFailure=false 时终止流程", async () => {
            const workflow: WorkflowDefinition = {
                id: "wf-fail-stop",
                name: "失败终止测试",
                description: "测试节点失败终止",
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
                            taskType: "ProvideData",
                            skipOnFailure: false
                        }
                    },
                    {
                        id: "task2",
                        type: WorkflowNodeType.Task,
                        position: { x: 200, y: 0 },
                        data: { label: "任务2", taskType: "Preprocess" }
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

            mockAdapter.setTaskResult("ProvideData", {
                success: false,
                error: "模拟失败",
                startedAt: Date.now(),
                completedAt: Date.now()
            });

            const executor = new WorkflowExecutor(workflow, "exec-fail-stop", mockAdapter);
            const execution = await executor.execute();

            expect(execution.status).toBe(WorkflowExecutionStatus.Failed);

            expect(execution.nodeStates.get("start")?.status).toBe(NodeExecutionStatus.Success);
            expect(execution.nodeStates.get("task1")?.status).toBe(NodeExecutionStatus.Failed);
            expect(execution.nodeStates.get("task2")?.status).toBe(NodeExecutionStatus.Cancelled);
            expect(execution.nodeStates.get("end")?.status).toBe(NodeExecutionStatus.Cancelled);
        });

        it("应该在节点失败且 skipOnFailure=true 时继续执行后续节点", async () => {
            const workflow: WorkflowDefinition = {
                id: "wf-fail-skip",
                name: "失败跳过测试",
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
                            taskType: "ProvideData",
                            skipOnFailure: true
                        }
                    },
                    {
                        id: "task2",
                        type: WorkflowNodeType.Task,
                        position: { x: 200, y: 0 },
                        data: { label: "任务2", taskType: "Preprocess" }
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

            mockAdapter.setTaskResult("ProvideData", {
                success: false,
                error: "模拟失败",
                startedAt: Date.now(),
                completedAt: Date.now()
            });

            const executor = new WorkflowExecutor(workflow, "exec-fail-skip", mockAdapter);
            const execution = await executor.execute();

            expect(execution.status).toBe(WorkflowExecutionStatus.Success);
            expect(execution.nodeStates.get("task1")?.status).toBe(NodeExecutionStatus.Failed);
            expect(execution.nodeStates.get("task2")?.status).toBe(NodeExecutionStatus.Success);
            expect(execution.nodeStates.get("end")?.status).toBe(NodeExecutionStatus.Success);
        });
    });

    describe("事件发射", () => {
        it("应该发射 executionStarted / executionCompleted / nodeStarted / nodeCompleted 事件", async () => {
            const workflow: WorkflowDefinition = {
                id: "wf-events-success",
                name: "事件测试（成功）",
                description: "测试成功事件发射",
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

            const executor = new WorkflowExecutor(workflow, "exec-events-success", mockAdapter);

            const events: string[] = [];

            executor.on("executionStarted", () => events.push("executionStarted"));
            executor.on("executionCompleted", () => events.push("executionCompleted"));
            executor.on("nodeStarted", () => events.push("nodeStarted"));
            executor.on("nodeCompleted", () => events.push("nodeCompleted"));

            await executor.execute();

            expect(events).toContain("executionStarted");
            expect(events).toContain("executionCompleted");
            expect(events).toContain("nodeStarted");
            expect(events).toContain("nodeCompleted");
        });

        it("应该在流程失败时发射 nodeFailed / executionFailed 事件", async () => {
            const workflow: WorkflowDefinition = {
                id: "wf-events-fail",
                name: "事件测试（失败）",
                description: "测试失败事件发射",
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
                        data: { label: "失败任务", taskType: "ProvideData", skipOnFailure: false }
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

            mockAdapter.setTaskResult("ProvideData", {
                success: false,
                error: "测试失败",
                startedAt: Date.now(),
                completedAt: Date.now()
            });

            const executor = new WorkflowExecutor(workflow, "exec-events-fail", mockAdapter);

            const nodeFailedEvents: any[] = [];
            const executionFailedEvents: any[] = [];

            executor.on("nodeFailed", payload => nodeFailedEvents.push(payload));
            executor.on("executionFailed", payload => executionFailedEvents.push(payload));

            const execution = await executor.execute();

            expect(execution.status).toBe(WorkflowExecutionStatus.Failed);
            expect(nodeFailedEvents.length).toBeGreaterThan(0);
            expect(executionFailedEvents.length).toBe(1);
        });
    });

    describe("执行上下文", () => {
        it("应该在执行完成后能从 ExecutionContext 读取节点结果", async () => {
            const workflow: WorkflowDefinition = {
                id: "wf-context",
                name: "上下文测试",
                description: "测试 ExecutionContext",
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
                        data: { label: "任务1", taskType: "ProvideData", params: { foo: "bar" } }
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

            const executor = new WorkflowExecutor(workflow, "exec-context", mockAdapter);

            await executor.execute();

            const context = executor.getExecutionContext();

            expect(context.getNodeResult("start")).toBeDefined();
            expect(context.getNodeResult("task1")).toBeDefined();
            expect(context.getNodeResult("end")).toBeDefined();

            expect(context.isNodeSuccess("start")).toBe(true);
            expect(context.isNodeSuccess("task1")).toBe(true);
            expect(context.isNodeSuccess("end")).toBe(true);
        });
    });
});
