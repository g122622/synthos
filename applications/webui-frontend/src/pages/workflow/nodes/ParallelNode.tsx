/**
 * 并行节点组件
 *
 * 宽条形节点，用于标记并行分支的起始/结束
 */

import React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Card, CardBody } from "@heroui/react";

/**
 * 并行节点组件
 */
export const ParallelNode: React.FC<NodeProps> = ({ data, selected }) => {
    const nodeData = data as any;

    return (
        <div className="relative">
            {/* 左侧入口 handle */}
            <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-warning-500" />

            <Card className={`min-w-[200px] border-3 border-warning-500 ${selected ? "ring-2 ring-warning-400" : ""}`} shadow="sm">
                <CardBody className="p-2">
                    <div className="flex items-center justify-center gap-2">
                        <span className="text-sm font-semibold text-warning-700">⚡ {nodeData.label || "并行"}</span>
                    </div>
                </CardBody>
            </Card>

            {/* 右侧出口 handle */}
            <Handle type="source" position={Position.Right} className="w-3 h-3 !bg-warning-500" />
        </div>
    );
};
