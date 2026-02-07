/**
 * 开始节点组件
 *
 * 圆形绿色节点，仅有 source handle（出口）
 */

import React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

/**
 * 开始节点组件
 */
export const StartNode: React.FC<NodeProps> = ({ data }) => {
    const nodeData = data as any;

    return (
        <div className="relative flex items-center justify-center w-16 h-16 bg-success-100 border-3 border-success-500 rounded-full shadow-md">
            <div className="text-success-700 text-xs font-semibold text-center">{nodeData.label || "开始"}</div>

            {/* 右侧出口 handle */}
            <Handle type="source" position={Position.Right} className="w-3 h-3 !bg-success-500" />
        </div>
    );
};
