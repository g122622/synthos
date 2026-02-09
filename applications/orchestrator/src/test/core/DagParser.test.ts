import { describe, it, expect } from "vitest";
import { WorkflowDefinition, WorkflowNodeType } from "@root/common/contracts/workflow/index";

import { DagParser } from "../../core/DagParser";

describe("DagParser", () => {
    describe("基本拓扑排序", () => {
        it("应该正确解析简单的线性工作流", () => {
            const workflow: WorkflowDefinition = {
                id: "wf-1",
                name: "线性工作流",
                description: "简单的线性流程",
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

            const parser = new DagParser(workflow);
            const plan = parser.parse();

            expect(plan.layers).toHaveLength(4);
            expect(plan.layers[0]).toEqual(["start"]);
            expect(plan.layers[1]).toEqual(["task1"]);
            expect(plan.layers[2]).toEqual(["task2"]);
            expect(plan.layers[3]).toEqual(["end"]);
        });

        it("应该正确识别并行分支", () => {
            const workflow: WorkflowDefinition = {
                id: "wf-2",
                name: "并行工作流",
                description: "包含并行分支的流程",
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
                        data: { label: "任务1" }
                    },
                    {
                        id: "task2",
                        type: WorkflowNodeType.Task,
                        position: { x: 100, y: 100 },
                        data: { label: "任务2" }
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

            const parser = new DagParser(workflow);
            const plan = parser.parse();

            expect(plan.layers).toHaveLength(3);
            expect(plan.layers[0]).toEqual(["start"]);
            expect(plan.layers[1]).toContain("task1");
            expect(plan.layers[1]).toContain("task2");
            expect(plan.layers[1]).toHaveLength(2);
            expect(plan.layers[2]).toEqual(["end"]);

            // 检查并行分支识别
            expect(plan.parallelBranches.has("start")).toBe(true);
            expect(plan.parallelBranches.get("start")).toEqual(expect.arrayContaining(["task1", "task2"]));
        });

        it("应该正确识别汇聚点", () => {
            const workflow: WorkflowDefinition = {
                id: "wf-3",
                name: "汇聚工作流",
                description: "包含汇聚点的流程",
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
                        data: { label: "任务1" }
                    },
                    {
                        id: "task2",
                        type: WorkflowNodeType.Task,
                        position: { x: 100, y: 100 },
                        data: { label: "任务2" }
                    },
                    {
                        id: "merge",
                        type: WorkflowNodeType.Task,
                        position: { x: 200, y: 50 },
                        data: { label: "汇聚任务" }
                    },
                    {
                        id: "end",
                        type: WorkflowNodeType.End,
                        position: { x: 300, y: 50 },
                        data: { label: "结束" }
                    }
                ],
                edges: [
                    { id: "e1", source: "start", target: "task1" },
                    { id: "e2", source: "start", target: "task2" },
                    { id: "e3", source: "task1", target: "merge" },
                    { id: "e4", source: "task2", target: "merge" },
                    { id: "e5", source: "merge", target: "end" }
                ]
            };

            const parser = new DagParser(workflow);
            const plan = parser.parse();

            // 检查汇聚点识别
            expect(plan.convergencePoints.has("merge")).toBe(true);
        });
    });

    describe("DAG 校验", () => {
        it("应该检测环路并抛出错误", () => {
            const workflow: WorkflowDefinition = {
                id: "wf-cycle",
                name: "环路工作流",
                description: "包含环路的非法流程",
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
                        data: { label: "任务1" }
                    },
                    {
                        id: "task2",
                        type: WorkflowNodeType.Task,
                        position: { x: 200, y: 0 },
                        data: { label: "任务2" }
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
                    { id: "e3", source: "task2", target: "task1" }, // 环路
                    { id: "e4", source: "task2", target: "end" }
                ]
            };

            const parser = new DagParser(workflow);

            expect(() => parser.parse()).toThrow("工作流中存在环路");
        });

        it("应该检测缺少 start 节点并抛出错误", () => {
            const workflow: WorkflowDefinition = {
                id: "wf-no-start",
                name: "无开始节点",
                description: "缺少 start 节点的非法流程",
                nodes: [
                    {
                        id: "task1",
                        type: WorkflowNodeType.Task,
                        position: { x: 100, y: 0 },
                        data: { label: "任务1" }
                    },
                    {
                        id: "end",
                        type: WorkflowNodeType.End,
                        position: { x: 200, y: 0 },
                        data: { label: "结束" }
                    }
                ],
                edges: [{ id: "e1", source: "task1", target: "end" }]
            };

            const parser = new DagParser(workflow);

            expect(() => parser.parse()).toThrow("工作流中必须有一个 start 节点");
        });

        it("应该检测多个 start 节点并抛出错误", () => {
            const workflow: WorkflowDefinition = {
                id: "wf-multi-start",
                name: "多个开始节点",
                description: "有多个 start 节点的非法流程",
                nodes: [
                    {
                        id: "start1",
                        type: WorkflowNodeType.Start,
                        position: { x: 0, y: 0 },
                        data: { label: "开始1" }
                    },
                    {
                        id: "start2",
                        type: WorkflowNodeType.Start,
                        position: { x: 0, y: 100 },
                        data: { label: "开始2" }
                    },
                    {
                        id: "end",
                        type: WorkflowNodeType.End,
                        position: { x: 200, y: 50 },
                        data: { label: "结束" }
                    }
                ],
                edges: [
                    { id: "e1", source: "start1", target: "end" },
                    { id: "e2", source: "start2", target: "end" }
                ]
            };

            const parser = new DagParser(workflow);

            expect(() => parser.parse()).toThrow("工作流中只能有一个 start 节点");
        });

        it("应该检测缺少 end 节点并抛出错误", () => {
            const workflow: WorkflowDefinition = {
                id: "wf-no-end",
                name: "无结束节点",
                description: "缺少 end 节点的非法流程",
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
                        data: { label: "任务1" }
                    }
                ],
                edges: [{ id: "e1", source: "start", target: "task1" }]
            };

            const parser = new DagParser(workflow);

            expect(() => parser.parse()).toThrow("工作流中必须有一个 end 节点");
        });

        it("应该检测不可达节点并抛出错误", () => {
            const workflow: WorkflowDefinition = {
                id: "wf-unreachable",
                name: "不可达节点",
                description: "包含不可达节点的非法流程",
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
                        data: { label: "任务1" }
                    },
                    {
                        id: "task2",
                        type: WorkflowNodeType.Task,
                        position: { x: 100, y: 100 },
                        data: { label: "孤立任务" }
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

            const parser = new DagParser(workflow);

            expect(() => parser.parse()).toThrow("以下节点从 start 节点不可达");
        });

        it("应该检测边的源节点不存在并抛出错误", () => {
            const workflow: WorkflowDefinition = {
                id: "wf-invalid-edge",
                name: "非法边",
                description: "边引用不存在的节点",
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
                        position: { x: 200, y: 0 },
                        data: { label: "结束" }
                    }
                ],
                edges: [
                    { id: "e1", source: "non-existent", target: "end" },
                    { id: "e2", source: "start", target: "end" }
                ]
            };

            const parser = new DagParser(workflow);

            expect(() => parser.parse()).toThrow("边 e1 的源节点 non-existent 不存在");
        });
    });

    describe("节点查询", () => {
        const workflow: WorkflowDefinition = {
            id: "wf-query",
            name: "查询测试",
            description: "用于测试节点查询功能",
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
                    data: { label: "任务1" }
                },
                {
                    id: "task2",
                    type: WorkflowNodeType.Task,
                    position: { x: 200, y: 0 },
                    data: { label: "任务2" }
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

        it("getNode 应该正确返回节点对象", () => {
            const parser = new DagParser(workflow);

            parser.parse();

            const node = parser.getNode("task1");

            expect(node).toBeDefined();
            expect(node?.id).toBe("task1");
            expect(node?.data.label).toBe("任务1");
        });

        it("getPredecessors 应该返回正确的前驱节点", () => {
            const parser = new DagParser(workflow);

            parser.parse();

            const predecessors = parser.getPredecessors("task2");

            expect(predecessors).toEqual(["task1"]);
        });

        it("getSuccessors 应该返回正确的后继节点", () => {
            const parser = new DagParser(workflow);

            parser.parse();

            const successors = parser.getSuccessors("task1");

            expect(successors).toEqual(["task2"]);
        });
    });
});
