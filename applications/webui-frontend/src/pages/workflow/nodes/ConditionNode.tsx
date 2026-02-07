/**
 * 条件分支节点组件
 *
 * 菱形节点，多个 source handle（true/false）
 */

import React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

/**
 * 条件节点组件
 */
export const ConditionNode: React.FC<NodeProps> = ({ data, selected }) => {
    const nodeData = data as any;

    return (
        <div className="relative">
            {/* 左侧入口 handle */}
            <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-secondary-500" />

            {/* 菱形主体 */}
            <div
                className={`
          w-32 h-32
          bg-secondary-100
          border-3 border-secondary-500
          transform rotate-45
          shadow-md
          ${selected ? "ring-2 ring-secondary-400" : ""}
        `}
            >
                {/* 内容容器（反向旋转回来） */}
                <div className="absolute inset-0 transform -rotate-45 flex items-center justify-center">
                    <div className="text-center px-2">
                        <div className="text-xs font-semibold text-secondary-700 mb-1">{nodeData.label || "条件"}</div>
                        {nodeData.conditionType && <div className="text-[10px] text-default-500">{nodeData.conditionType}</div>}
                    </div>
                </div>
            </div>

            {/* 右上出口 handle (true) */}
            <Handle type="source" position={Position.Top} id="true" className="w-3 h-3 !bg-success-500 !right-8 !top-0" style={{ left: "auto" }} />

            {/* 右下出口 handle (false) */}
            <Handle type="source" position={Position.Bottom} id="false" className="w-3 h-3 !bg-danger-500 !right-8 !bottom-0" style={{ left: "auto" }} />
        </div>
    );
};
