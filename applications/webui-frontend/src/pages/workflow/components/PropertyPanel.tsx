/**
 * 节点属性面板组件
 *
 * 根据选中节点类型动态渲染不同的属性表单
 */

import React from "react";
import { useWorkflowStore } from "../stores/workflowStore";
import { TaskPropertyForm } from "./property-forms/TaskPropertyForm";
import { ConditionPropertyForm } from "./property-forms/ConditionPropertyForm";
import { ScriptPropertyForm } from "./property-forms/ScriptPropertyForm";
import { HttpPropertyForm } from "./property-forms/HttpPropertyForm";
import { Input } from "@heroui/react";
import type { WorkflowNodeData } from "../types/index";

/**
 * 属性面板组件
 */
export const PropertyPanel: React.FC = () => {
    const { nodes, selectedNodeId, updateNode } = useWorkflowStore();

    const selectedNode = nodes.find(n => n.id === selectedNodeId);

    if (!selectedNode) {
        return (
            <div className="w-80 border-l border-divider bg-content1 p-4 flex items-center justify-center">
                <p className="text-sm text-default-500 text-center">请选择一个节点以编辑属性</p>
            </div>
        );
    }

    const handleChange = (updates: Partial<WorkflowNodeData>) => {
        if (selectedNodeId) {
            updateNode(selectedNodeId, updates);
        }
    };

    const nodeData = selectedNode.data as WorkflowNodeData;

    return (
        <div className="w-80 border-l border-divider bg-content1 p-4 overflow-y-auto">
            <h2 className="text-sm font-semibold mb-3">属性面板</h2>

            {/* 节点 ID（只读） */}
            <div className="mb-4">
                <Input label="节点 ID" size="sm" value={selectedNode.id} isReadOnly description="节点唯一标识符" />
            </div>

            {/* 根据节点类型渲染不同表单 */}
            {selectedNode.type === "task" && <TaskPropertyForm data={nodeData} onChange={handleChange} />}

            {selectedNode.type === "condition" && <ConditionPropertyForm data={nodeData} onChange={handleChange} />}

            {selectedNode.type === "script" && <ScriptPropertyForm data={nodeData} onChange={handleChange} />}

            {selectedNode.type === "http" && <HttpPropertyForm data={nodeData} onChange={handleChange} />}

            {selectedNode.type === "parallel" && (
                <div className="flex flex-col gap-3">
                    <Input label="节点名称" size="sm" value={nodeData.label} onChange={e => handleChange({ label: e.target.value })} />
                </div>
            )}

            {(selectedNode.type === "start" || selectedNode.type === "end") && (
                <div className="flex flex-col gap-3">
                    <Input label="节点名称" size="sm" value={nodeData.label} onChange={e => handleChange({ label: e.target.value })} />
                    <p className="text-xs text-default-500">{selectedNode.type === "start" ? "开始节点：工作流的入口点" : "结束节点：工作流的出口点"}</p>
                </div>
            )}
        </div>
    );
};
