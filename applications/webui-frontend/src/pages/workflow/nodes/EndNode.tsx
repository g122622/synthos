/**
 * 结束节点组件
 *
 * 圆形红色节点，仅有 target handle（入口）
 */

import React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

/**
 * 结束节点组件
 */
export const EndNode: React.FC<NodeProps> = ({ data }) => {
    const nodeData = data as any;

    return (
        <div className="relative flex items-center justify-center w-16 h-16 bg-danger-100 border-3 border-danger-500 rounded-full shadow-md">
            <div className="text-danger-700 text-xs font-semibold text-center">{nodeData.label || "结束"}</div>

            {/* 左侧入口 handle */}
            <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-danger-500" />
        </div>
    );
};
