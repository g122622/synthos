/**
 * 任务节点组件
 *
 * 卡片式节点，显示任务类型图标 + label + 状态指示
 */

import React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Card, CardBody, Chip } from "@heroui/react";
import type { NodeExecutionStatus } from "../types/index";

/**
 * 根据执行状态获取边框颜色类名
 */
const getStatusBorderClass = (status?: NodeExecutionStatus): string => {
    switch (status) {
        case "running":
            return "border-primary-500 animate-pulse";
        case "success":
            return "border-success-500";
        case "failed":
            return "border-danger-500";
        case "skipped":
            return "border-warning-500";
        case "cancelled":
            return "border-default-400";
        case "pending":
        default:
            return "border-default-300";
    }
};

/**
 * 根据执行状态获取 Chip 颜色
 */
const getStatusChipColor = (status?: NodeExecutionStatus): "default" | "primary" | "success" | "warning" | "danger" => {
    switch (status) {
        case "running":
            return "primary";
        case "success":
            return "success";
        case "failed":
            return "danger";
        case "skipped":
            return "warning";
        case "cancelled":
        case "pending":
        default:
            return "default";
    }
};

/**
 * 任务节点组件
 */
export const TaskNode: React.FC<NodeProps> = ({ data, selected }) => {
    const nodeData = data as any;
    const borderClass = getStatusBorderClass(nodeData.status);
    const chipColor = getStatusChipColor(nodeData.status);

    return (
        <div className="relative">
            {/* 左侧入口 handle */}
            <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-primary-500" />

            <Card className={`min-w-[180px] border-3 ${borderClass} ${selected ? "ring-2 ring-primary-400" : ""}`} shadow="sm">
                <CardBody className="p-3">
                    <div className="flex flex-col gap-2">
                        {/* 标题行 */}
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-foreground truncate">{nodeData.label}</span>
                            {nodeData.status && (
                                <Chip color={chipColor} size="sm" variant="flat">
                                    {nodeData.status}
                                </Chip>
                            )}
                        </div>

                        {/* 任务类型 */}
                        {nodeData.taskType && <div className="text-xs text-default-500">类型: {nodeData.taskType}</div>}
                    </div>
                </CardBody>
            </Card>

            {/* 右侧出口 handle */}
            <Handle type="source" position={Position.Right} className="w-3 h-3 !bg-primary-500" />
        </div>
    );
};
