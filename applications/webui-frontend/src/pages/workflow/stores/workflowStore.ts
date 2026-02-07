/**
 * 工作流编排 - 全局状态管理（Zustand）
 *
 * 管理工作流定义、选中状态、执行状态等
 */

import type { Node, Edge, Viewport } from "@xyflow/react";
import type { WorkflowDefinition, WorkflowExecution, WorkflowNodeData, NodeExecutionStatus } from "../types/index";

import { create } from "zustand";

/**
 * 工作流 Store 状态接口
 */
interface WorkflowStore {
    // 工作流列表
    workflows: WorkflowDefinition[];
    currentWorkflowId: string | null;

    // React Flow 状态
    nodes: Node[];
    edges: Edge[];
    viewport: Viewport;

    // 选中状态
    selectedNodeId: string | null;

    // 执行状态
    currentExecution: WorkflowExecution | null;
    executionHistory: WorkflowExecution[];

    // Actions
    setWorkflows: (workflows: WorkflowDefinition[]) => void;
    setCurrentWorkflow: (workflowId: string) => void;
    loadWorkflow: (workflow: WorkflowDefinition) => void;

    setNodes: (nodes: Node[]) => void;
    setEdges: (edges: Edge[]) => void;
    setViewport: (viewport: Viewport) => void;

    addNode: (node: Node) => void;
    updateNode: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
    deleteNode: (nodeId: string) => void;

    addEdge: (edge: Edge) => void;
    deleteEdge: (edgeId: string) => void;

    setSelectedNode: (nodeId: string | null) => void;

    updateNodeStatus: (nodeId: string, status: NodeExecutionStatus) => void;
    setCurrentExecution: (execution: WorkflowExecution | null) => void;
    addExecutionToHistory: (execution: WorkflowExecution) => void;

    getCurrentWorkflowDefinition: () => WorkflowDefinition | null;
    reset: () => void;
}

/**
 * 创建 Zustand Store
 */
export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
    // 初始状态
    workflows: [],
    currentWorkflowId: null,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    selectedNodeId: null,
    currentExecution: null,
    executionHistory: [],

    // 设置工作流列表
    setWorkflows: workflows => set({ workflows }),

    // 切换当前工作流
    setCurrentWorkflow: workflowId => {
        const workflow = get().workflows.find(w => w.id === workflowId);

        if (workflow) {
            get().loadWorkflow(workflow);
        }
        set({ currentWorkflowId: workflowId });
    },

    // 加载工作流到画布
    loadWorkflow: workflow => {
        set({
            currentWorkflowId: workflow.id,
            nodes: workflow.nodes as Node[],
            edges: workflow.edges as Edge[],
            viewport: workflow.viewport || { x: 0, y: 0, zoom: 1 },
            selectedNodeId: null,
            currentExecution: null
        });
    },

    // 设置节点
    setNodes: nodes => set({ nodes }),

    // 设置边
    setEdges: edges => set({ edges }),

    // 设置视口
    setViewport: viewport => set({ viewport }),

    // 添加节点
    addNode: node =>
        set(state => ({
            nodes: [...state.nodes, node]
        })),

    // 更新节点数据
    updateNode: (nodeId, data) =>
        set(state => ({
            nodes: state.nodes.map(node => (node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node))
        })),

    // 删除节点
    deleteNode: nodeId =>
        set(state => ({
            nodes: state.nodes.filter(node => node.id !== nodeId),
            edges: state.edges.filter(edge => edge.source !== nodeId && edge.target !== nodeId),
            selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId
        })),

    // 添加边
    addEdge: edge =>
        set(state => ({
            edges: [...state.edges, edge]
        })),

    // 删除边
    deleteEdge: edgeId =>
        set(state => ({
            edges: state.edges.filter(edge => edge.id !== edgeId)
        })),

    // 设置选中节点
    setSelectedNode: nodeId => set({ selectedNodeId: nodeId }),

    // 更新节点执行状态
    updateNodeStatus: (nodeId, status) =>
        set(state => ({
            nodes: state.nodes.map(node => (node.id === nodeId ? { ...node, data: { ...node.data, status } } : node))
        })),

    // 设置当前执行
    setCurrentExecution: execution => set({ currentExecution: execution }),

    // 添加执行历史
    addExecutionToHistory: execution =>
        set(state => ({
            executionHistory: [execution, ...state.executionHistory].slice(0, 50) // 保留最近 50 条
        })),

    // 获取当前工作流定义
    getCurrentWorkflowDefinition: () => {
        const { currentWorkflowId, nodes, edges, viewport } = get();

        if (!currentWorkflowId) {
            return null;
        }

        const currentWorkflow = get().workflows.find(w => w.id === currentWorkflowId);

        return {
            id: currentWorkflowId,
            name: currentWorkflow?.name || "未命名工作流",
            description: currentWorkflow?.description,
            nodes: nodes.map(node => ({
                id: node.id,
                type: node.type as any,
                position: node.position,
                data: node.data as WorkflowNodeData
            })),
            edges: edges.map(edge => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
                sourceHandle: edge.sourceHandle as string | undefined,
                label: edge.label as string | undefined
            })),
            viewport
        } as WorkflowDefinition;
    },

    // 重置状态
    reset: () =>
        set({
            nodes: [],
            edges: [],
            viewport: { x: 0, y: 0, zoom: 1 },
            selectedNodeId: null,
            currentExecution: null
        })
}));
