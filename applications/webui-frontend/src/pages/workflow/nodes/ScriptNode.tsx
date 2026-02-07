/**
 * 脚本节点组件
 *
 * 代码图标节点，用于执行自定义脚本
 */

import React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Card, CardBody } from "@heroui/react";
import { Code2 } from "lucide-react";

/**
 * 脚本节点组件
 */
export const ScriptNode: React.FC<NodeProps> = ({ data, selected }) => {
    const nodeData = data as any;

    return (
        <div className="relative">
            {/* 左侧入口 handle */}
            <Handle className="w-3 h-3 !bg-purple-500" position={Position.Left} type="target" />

            <Card className={`min-w-[160px] border-3 border-purple-500 ${selected ? "ring-2 ring-purple-400" : ""}`} shadow="sm">
                <CardBody className="p-3">
                    <div className="flex items-center gap-2">
                        <Code2 className="w-4 h-4 text-purple-600 flex-shrink-0" />
                        <span className="text-sm font-semibold text-foreground truncate">{nodeData.label || "脚本"}</span>
                    </div>
                    {nodeData.scriptCode && <div className="text-xs text-default-500 mt-1 truncate">{nodeData.scriptCode.slice(0, 30)}...</div>}
                </CardBody>
            </Card>

            {/* 右侧出口 handle */}
            <Handle className="w-3 h-3 !bg-purple-500" position={Position.Right} type="source" />
        </div>
    );
};
