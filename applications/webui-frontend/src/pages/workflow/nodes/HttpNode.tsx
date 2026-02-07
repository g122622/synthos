/**
 * HTTP 请求节点组件
 *
 * 网络图标节点，显示 HTTP method 和 URL
 */

import React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Card, CardBody, Chip } from "@heroui/react";
import { Globe } from "lucide-react";

/**
 * 根据 HTTP method 获取 Chip 颜色
 */
const getMethodColor = (method?: string): "default" | "primary" | "success" | "warning" | "danger" => {
    switch (method?.toUpperCase()) {
        case "GET":
            return "primary";
        case "POST":
            return "success";
        case "PUT":
            return "warning";
        case "DELETE":
            return "danger";
        default:
            return "default";
    }
};

/**
 * HTTP 节点组件
 */
export const HttpNode: React.FC<NodeProps> = ({ data, selected }) => {
    const nodeData = data as any;
    const method = nodeData.httpConfig?.method || "GET";
    const url = nodeData.httpConfig?.url || "";

    return (
        <div className="relative">
            {/* 左侧入口 handle */}
            <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-blue-500" />

            <Card className={`min-w-[200px] border-3 border-blue-500 ${selected ? "ring-2 ring-blue-400" : ""}`} shadow="sm">
                <CardBody className="p-3">
                    <div className="flex flex-col gap-2">
                        {/* 标题行 */}
                        <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-blue-600 flex-shrink-0" />
                            <span className="text-sm font-semibold text-foreground truncate">{nodeData.label || "HTTP 请求"}</span>
                        </div>

                        {/* Method 和 URL */}
                        <div className="flex items-center gap-2">
                            <Chip color={getMethodColor(method)} size="sm" variant="flat">
                                {method}
                            </Chip>
                            <span className="text-xs text-default-500 truncate flex-1">{url || "未配置 URL"}</span>
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* 右侧出口 handle */}
            <Handle type="source" position={Position.Right} className="w-3 h-3 !bg-blue-500" />
        </div>
    );
};
