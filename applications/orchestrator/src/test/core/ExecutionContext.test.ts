import { describe, it, expect, beforeEach } from "vitest";
import { NodeExecutionStatus } from "@root/common/contracts/workflow/index";
import { ExecutionContext } from "@root/common/scheduler/helpers/ExecutionContext";

describe("ExecutionContext", () => {
    let context: ExecutionContext;
    const executionId = "test-execution-001";

    beforeEach(() => {
        context = new ExecutionContext(executionId);
    });

    describe("基本功能", () => {
        it("应该正确初始化执行 ID", () => {
            expect(context.getExecutionId()).toBe(executionId);
        });

        it("应该能够设置和获取节点执行结果", () => {
            const nodeId = "node-1";
            const result = {
                success: true,
                output: { data: "test output" },
                startedAt: Date.now(),
                completedAt: Date.now() + 1000
            };

            context.setNodeResult(nodeId, result);
            const retrieved = context.getNodeResult(nodeId);

            expect(retrieved).toEqual(result);
        });

        it("获取不存在的节点结果应该返回 undefined", () => {
            const result = context.getNodeResult("non-existent-node");

            expect(result).toBeUndefined();
        });
    });

    describe("上游节点输出", () => {
        it("应该能够获取上游节点的输出数据", () => {
            const nodeId = "node-1";
            const outputData = { key: "value", count: 42 };
            const result = {
                success: true,
                output: outputData,
                startedAt: Date.now(),
                completedAt: Date.now() + 1000
            };

            context.setNodeResult(nodeId, result);
            const retrieved = context.getUpstreamOutput(nodeId);

            expect(retrieved).toEqual(outputData);
        });

        it("获取未执行节点的输出应该返回 undefined", () => {
            const output = context.getUpstreamOutput("non-existent-node");

            expect(output).toBeUndefined();
        });

        it("获取没有输出的节点应该返回 undefined", () => {
            const nodeId = "node-1";
            const result = {
                success: true,
                startedAt: Date.now(),
                completedAt: Date.now() + 1000
            };

            context.setNodeResult(nodeId, result);
            const output = context.getUpstreamOutput(nodeId);

            expect(output).toBeUndefined();
        });
    });

    describe("节点状态检查", () => {
        it("isNodeCompleted 应该正确判断节点是否完成", () => {
            const nodeId = "node-1";

            expect(context.isNodeCompleted(nodeId)).toBe(false);

            context.setNodeResult(nodeId, {
                success: true,
                startedAt: Date.now(),
                completedAt: Date.now() + 1000
            });

            expect(context.isNodeCompleted(nodeId)).toBe(true);
        });

        it("isNodeSuccess 应该正确判断节点是否成功", () => {
            const nodeId = "node-1";

            expect(context.isNodeSuccess(nodeId)).toBe(false);

            context.setNodeResult(nodeId, {
                success: true,
                startedAt: Date.now(),
                completedAt: Date.now() + 1000
            });

            expect(context.isNodeSuccess(nodeId)).toBe(true);
        });

        it("isNodeFailed 应该正确判断节点是否失败", () => {
            const nodeId = "node-1";

            expect(context.isNodeFailed(nodeId)).toBe(false);

            context.setNodeResult(nodeId, {
                success: false,
                error: "执行失败",
                startedAt: Date.now(),
                completedAt: Date.now() + 1000
            });

            expect(context.isNodeFailed(nodeId)).toBe(true);
        });
    });

    describe("节点状态管理", () => {
        it("应该能够设置和获取节点状态", () => {
            const nodeId = "node-1";
            const state = {
                nodeId,
                status: NodeExecutionStatus.Running
            };

            context.setNodeState(nodeId, state);
            const retrieved = context.getNodeState(nodeId);

            expect(retrieved).toEqual(state);
        });

        it("应该能够更新节点状态", () => {
            const nodeId = "node-1";

            context.updateNodeStatus(nodeId, NodeExecutionStatus.Pending);
            expect(context.getNodeState(nodeId)?.status).toBe(NodeExecutionStatus.Pending);

            context.updateNodeStatus(nodeId, NodeExecutionStatus.Running);
            expect(context.getNodeState(nodeId)?.status).toBe(NodeExecutionStatus.Running);

            context.updateNodeStatus(nodeId, NodeExecutionStatus.Success);
            expect(context.getNodeState(nodeId)?.status).toBe(NodeExecutionStatus.Success);
        });

        it("getAllNodeStates 应该返回所有节点状态的副本", () => {
            context.setNodeState("node-1", { nodeId: "node-1", status: NodeExecutionStatus.Success });
            context.setNodeState("node-2", { nodeId: "node-2", status: NodeExecutionStatus.Running });

            const allStates = context.getAllNodeStates();

            expect(allStates.size).toBe(2);
            expect(allStates.get("node-1")?.status).toBe(NodeExecutionStatus.Success);
            expect(allStates.get("node-2")?.status).toBe(NodeExecutionStatus.Running);
        });
    });

    describe("全局变量管理", () => {
        it("应该能够设置和获取全局变量", () => {
            context.setGlobalVar("startTime", 1234567890);
            context.setGlobalVar("groupIds", ["group1", "group2"]);

            expect(context.getGlobalVar("startTime")).toBe(1234567890);
            expect(context.getGlobalVar("groupIds")).toEqual(["group1", "group2"]);
        });

        it("hasGlobalVar 应该正确判断变量是否存在", () => {
            expect(context.hasGlobalVar("key")).toBe(false);

            context.setGlobalVar("key", "value");
            expect(context.hasGlobalVar("key")).toBe(true);
        });

        it("应该能够删除全局变量", () => {
            context.setGlobalVar("key", "value");
            expect(context.hasGlobalVar("key")).toBe(true);

            context.deleteGlobalVar("key");
            expect(context.hasGlobalVar("key")).toBe(false);
        });

        it("getAllGlobalVars 应该返回所有全局变量的副本", () => {
            context.setGlobalVar("var1", 100);
            context.setGlobalVar("var2", "test");

            const allVars = context.getAllGlobalVars();

            expect(allVars.size).toBe(2);
            expect(allVars.get("var1")).toBe(100);
            expect(allVars.get("var2")).toBe("test");
        });
    });

    describe("清空和序列化", () => {
        beforeEach(() => {
            context.setNodeResult("node-1", {
                success: true,
                output: { data: "test" },
                startedAt: Date.now(),
                completedAt: Date.now() + 1000
            });
            context.setNodeState("node-1", { nodeId: "node-1", status: NodeExecutionStatus.Success });
            context.setGlobalVar("testVar", "testValue");
        });

        it("clear 应该清空所有数据", () => {
            context.clear();

            expect(context.getNodeResult("node-1")).toBeUndefined();
            expect(context.getNodeState("node-1")).toBeUndefined();
            expect(context.hasGlobalVar("testVar")).toBe(false);
        });

        it("序列化和反序列化应该保持数据完整性", () => {
            const serialized = context.serialize();

            expect(serialized.executionId).toBe(executionId);
            expect(serialized.nodeResults.length).toBe(1);
            expect(serialized.nodeStates.length).toBe(1);
            expect(serialized.globalVars.length).toBe(1);

            const restored = ExecutionContext.deserialize(serialized);

            expect(restored.getExecutionId()).toBe(executionId);
            expect(restored.getNodeResult("node-1")).toBeDefined();
            expect(restored.getNodeState("node-1")?.status).toBe(NodeExecutionStatus.Success);
            expect(restored.getGlobalVar("testVar")).toBe("testValue");
        });
    });
});
