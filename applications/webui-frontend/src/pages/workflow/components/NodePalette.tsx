/**
 * 节点面板组件
 *
 * 展示所有可用节点类型，支持拖拽到画布创建节点
 */

import type { WorkflowNodeType } from "../types/index";

import React from "react";
import { Card, CardBody } from "@heroui/react";
import { Circle, Square, GitBranch, Zap, Code2, Globe } from "lucide-react";

/**
 * 节点类型配置
 */
const NODE_TYPES: Array<{
    type: WorkflowNodeType;
    label: string;
    icon: React.ReactNode;
    color: string;
    description: string;
}> = [
    {
        type: "start",
        label: "开始",
        icon: <Circle className="w-4 h-4" />,
        color: "text-success-600",
        description: "工作流入口点"
    },
    {
        type: "end",
        label: "结束",
        icon: <Circle className="w-4 h-4" />,
        color: "text-danger-600",
        description: "工作流出口点"
    },
    {
        type: "task",
        label: "任务",
        icon: <Square className="w-4 h-4" />,
        color: "text-primary-600",
        description: "执行具体任务"
    },
    {
        type: "condition",
        label: "条件",
        icon: <GitBranch className="w-4 h-4" />,
        color: "text-secondary-600",
        description: "条件分支判断"
    },
    {
        type: "parallel",
        label: "并行",
        icon: <Zap className="w-4 h-4" />,
        color: "text-warning-600",
        description: "并行执行分支"
    },
    {
        type: "script",
        label: "脚本",
        icon: <Code2 className="w-4 h-4" />,
        color: "text-purple-600",
        description: "执行自定义脚本"
    },
    {
        type: "http",
        label: "HTTP",
        icon: <Globe className="w-4 h-4" />,
        color: "text-blue-600",
        description: "HTTP 请求"
    }
];

/**
 * 节点面板组件
 */
export const NodePalette: React.FC = () => {
    /**
     * 开始拖拽节点
     */
    const onDragStart = (event: React.DragEvent, nodeType: WorkflowNodeType) => {
        event.dataTransfer.setData("application/reactflow", nodeType);
        event.dataTransfer.effectAllowed = "move";
    };

    return (
        <div className="w-64 border-r border-divider bg-content1 p-4 overflow-y-auto">
            <h2 className="text-sm font-semibold mb-3">节点面板</h2>
            <p className="text-xs text-default-500 mb-4">拖拽节点到画布创建</p>

            <div className="flex flex-col gap-2">
                {NODE_TYPES.map(nodeType => (
                    <Card
                        key={nodeType.type}
                        draggable
                        isPressable
                        className="cursor-grab active:cursor-grabbing hover:scale-105 transition-transform"
                        shadow="sm"
                        onDragStart={e => onDragStart(e, nodeType.type)}
                    >
                        <CardBody className="p-3">
                            <div className="flex items-start gap-3">
                                <div className={nodeType.color}>{nodeType.icon}</div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-foreground">{nodeType.label}</p>
                                    <p className="text-xs text-default-500 truncate">{nodeType.description}</p>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                ))}
            </div>
        </div>
    );
};
