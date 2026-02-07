/**
 * React Flow 画布组件
 *
 * 核心可视化画布，支持拖拽、缩放、连线等交互
 */

import type { WorkflowNodeType } from "../types/index";

import React, { useCallback } from "react";
import { ReactFlow, Controls, Background, MiniMap, useNodesState, useEdgesState, type Connection, type Edge, type Node, BackgroundVariant, ConnectionMode, type OnConnect } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useWorkflowStore } from "../stores/workflowStore";
import { StartNode, EndNode, TaskNode, ConditionNode, ParallelNode, ScriptNode, HttpNode } from "../nodes/index";

import { ContextMenu } from "./ContextMenu";

/**
 * 节点类型映射
 */
const nodeTypes = {
    start: StartNode,
    end: EndNode,
    task: TaskNode,
    condition: ConditionNode,
    parallel: ParallelNode,
    script: ScriptNode,
    http: HttpNode
};

/**
 * 工作流画布组件
 */
export const WorkflowCanvas: React.FC = () => {
    const {
        nodes: storeNodes,
        edges: storeEdges,
        setNodes: setStoreNodes,
        setEdges: setStoreEdges,
        setSelectedNode,
        addNode: addStoreNode,
        addEdge: addStoreEdge,
        deleteNode: deleteStoreNode,
        deleteEdge: deleteStoreEdge
    } = useWorkflowStore();

    const [nodes, setNodes, onNodesChange] = useNodesState(storeNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(storeEdges);
    const reactFlowWrapper = React.useRef<HTMLDivElement>(null);
    const [reactFlowInstance, setReactFlowInstance] = React.useState<any>(null);

    // 右键菜单状态
    const [contextMenu, setContextMenu] = React.useState<{
        visible: boolean;
        position: { x: number; y: number };
        targetType: "node" | "edge" | "pane";
        targetId?: string;
    } | null>(null);

    // 当 store 中的节点/边变化时，同步到 React Flow
    React.useEffect(() => {
        setNodes(storeNodes);
    }, [storeNodes, setNodes]);

    React.useEffect(() => {
        setEdges(storeEdges);
    }, [storeEdges, setEdges]);

    // 同步 React Flow 状态到 Zustand
    React.useEffect(() => {
        setStoreNodes(nodes);
    }, [nodes, setStoreNodes]);

    React.useEffect(() => {
        setStoreEdges(edges);
    }, [edges, setStoreEdges]);

    // 节点连线回调
    const onConnect: OnConnect = useCallback(
        (connection: Connection) => {
            if (!connection.source || !connection.target) {
                return;
            }

            // 连线规则校验
            const sourceNode = nodes.find(n => n.id === connection.source);
            const targetNode = nodes.find(n => n.id === connection.target);

            // 不允许自环
            if (connection.source === connection.target) {
                console.warn("❌ 不允许节点连接到自己");

                return;
            }

            // start 节点不可有入边（已在 handle 配置中限制）
            if (targetNode?.type === "start") {
                console.warn("❌ start 节点不可有入边");

                return;
            }

            // end 节点不可有出边（已在 handle 配置中限制）
            if (sourceNode?.type === "end") {
                console.warn("❌ end 节点不可有出边");

                return;
            }

            const newEdge: Edge = {
                id: `e${connection.source}-${connection.target}`,
                source: connection.source,
                target: connection.target,
                sourceHandle: connection.sourceHandle || undefined,
                targetHandle: connection.targetHandle || undefined
            };

            addStoreEdge(newEdge);
        },
        [nodes, addStoreEdge]
    );

    // 节点点击回调
    const onNodeClick = useCallback(
        (_event: React.MouseEvent, node: Node) => {
            setSelectedNode(node.id);
        },
        [setSelectedNode]
    );

    // 画布点击回调（取消选中）
    const onPaneClick = useCallback(() => {
        setSelectedNode(null);
    }, [setSelectedNode]);

    /**
     * 节点右键菜单
     */
    const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
        event.preventDefault();
        setContextMenu({
            visible: true,
            position: { x: event.clientX, y: event.clientY },
            targetType: "node",
            targetId: node.id
        });
    }, []);

    /**
     * 边右键菜单
     */
    const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
        event.preventDefault();
        setContextMenu({
            visible: true,
            position: { x: event.clientX, y: event.clientY },
            targetType: "edge",
            targetId: edge.id
        });
    }, []);

    /**
     * 复制节点
     */
    const handleCopyNode = useCallback(() => {
        if (!contextMenu?.targetId) {
            return;
        }

        const sourceNode = nodes.find(n => n.id === contextMenu.targetId);

        if (!sourceNode) {
            return;
        }

        const newNode: Node = {
            ...sourceNode,
            id: `${sourceNode.type}-${Date.now()}`,
            position: {
                x: sourceNode.position.x + 50,
                y: sourceNode.position.y + 50
            },
            data: {
                ...sourceNode.data,
                label: `${sourceNode.data.label}（副本）`
            }
        };

        addStoreNode(newNode);
    }, [contextMenu, nodes, addStoreNode]);

    /**
     * 删除节点或边
     */
    const handleDelete = useCallback(() => {
        if (!contextMenu?.targetId) {
            return;
        }

        if (contextMenu.targetType === "node") {
            deleteStoreNode(contextMenu.targetId);
        } else if (contextMenu.targetType === "edge") {
            deleteStoreEdge(contextMenu.targetId);
        }
    }, [contextMenu, deleteStoreNode, deleteStoreEdge]);

    /**
     * 处理节点拖放到画布
     */
    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const type = event.dataTransfer.getData("application/reactflow") as WorkflowNodeType;

            if (!type || !reactFlowInstance) {
                return;
            }

            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY
            });

            const newNode: Node = {
                id: `${type}-${Date.now()}`,
                type,
                position,
                data: {
                    label: getDefaultLabel(type)
                }
            };

            addStoreNode(newNode);
        },
        [reactFlowInstance, addStoreNode]
    );

    /**
     * 获取节点类型的默认标签
     */
    const getDefaultLabel = (type: WorkflowNodeType): string => {
        const labels: Record<WorkflowNodeType, string> = {
            start: "开始",
            end: "结束",
            task: "新任务",
            condition: "条件判断",
            parallel: "并行",
            script: "脚本",
            http: "HTTP 请求"
        };

        return labels[type] || "节点";
    };

    return (
        <div ref={reactFlowWrapper} className="flex-1 h-full">
            <ReactFlow
                fitView
                snapToGrid
                connectionMode={ConnectionMode.Loose}
                deleteKeyCode="Delete"
                edges={edges}
                maxZoom={2}
                minZoom={0.1}
                nodeTypes={nodeTypes}
                nodes={nodes}
                snapGrid={[15, 15]}
                onConnect={onConnect}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onEdgeContextMenu={onEdgeContextMenu}
                onEdgesChange={onEdgesChange}
                onInit={setReactFlowInstance}
                onNodeClick={onNodeClick}
                onNodeContextMenu={onNodeContextMenu}
                onNodesChange={onNodesChange}
                onPaneClick={onPaneClick}
            >
                <Background color="#888" gap={15} size={1} variant={BackgroundVariant.Dots} />
                <Controls showFitView showZoom position="top-left" showInteractive={false} />
                <MiniMap pannable zoomable nodeStrokeWidth={3} position="bottom-right" />
            </ReactFlow>

            {contextMenu && contextMenu.visible && (
                <ContextMenu
                    position={contextMenu.position}
                    targetId={contextMenu.targetId}
                    targetType={contextMenu.targetType}
                    onClose={() => setContextMenu(null)}
                    onCopy={contextMenu.targetType === "node" ? handleCopyNode : undefined}
                    onDelete={handleDelete}
                />
            )}
        </div>
    );
};
