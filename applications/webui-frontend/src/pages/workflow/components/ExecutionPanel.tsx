/**
 * 执行历史面板组件
 *
 * 展示工作流执行历史记录，支持快照加载和分页
 */

import React from "react";
import { Card, CardBody, Button, Chip, Pagination } from "@heroui/react";
import { Clock, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import type { ExecutionSummary } from "../types/index";

export interface ExecutionPanelProps {
    /**
     * 执行历史列表
     */
    executions: ExecutionSummary[];

    /**
     * 是否正在加载
     */
    isLoading?: boolean;

    /**
     * 总记录数
     */
    totalCount: number;

    /**
     * 当前页码（1-based）
     */
    currentPage: number;

    /**
     * 每页记录数
     */
    pageSize: number;

    /**
     * 页码变更回调
     */
    onPageChange: (page: number) => void;

    /**
     * 加载快照回调
     */
    onLoadSnapshot: (executionId: string) => void;
}

/**
 * 格式化时间戳为可读字符串
 */
const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
};

/**
 * 计算执行时长（秒）
 */
const calculateDuration = (startedAt: number, completedAt?: number): string => {
    const endTime = completedAt || Date.now();
    const durationMs = endTime - startedAt;
    const seconds = Math.floor(durationMs / 1000);

    if (seconds < 60) {
        return `${seconds}秒`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
};

/**
 * 获取状态配置
 */
const getStatusConfig = (status: ExecutionSummary["status"]) => {
    switch (status) {
        case "success":
            return {
                icon: <CheckCircle2 size={14} />,
                color: "success" as const,
                label: "已完成"
            };
        case "failed":
            return {
                icon: <XCircle size={14} />,
                color: "danger" as const,
                label: "已失败"
            };
        case "running":
            return {
                icon: <Loader2 size={14} className="animate-spin" />,
                color: "primary" as const,
                label: "运行中"
            };
        case "cancelled":
            return {
                icon: <AlertCircle size={14} />,
                color: "warning" as const,
                label: "已取消"
            };
        default:
            return {
                icon: <Clock size={14} />,
                color: "default" as const,
                label: "待执行"
            };
    }
};

/**
 * 执行历史面板组件
 */
export const ExecutionPanel: React.FC<ExecutionPanelProps> = ({ executions, isLoading = false, totalCount, currentPage, pageSize, onPageChange, onLoadSnapshot }) => {
    const totalPages = Math.ceil(totalCount / pageSize);

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">执行历史</h2>
                <span className="text-xs text-default-500">共 {totalCount} 条记录</span>
            </div>

            {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 size={24} className="animate-spin text-primary" />
                </div>
            ) : executions.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-sm text-default-400">暂无执行记录</p>
                </div>
            ) : (
                <>
                    <div className="flex-1 overflow-y-auto space-y-2">
                        {executions.map(execution => {
                            const statusConfig = getStatusConfig(execution.status);
                            const { progress } = execution;
                            const completedNodeCount = progress.completed + progress.failed;
                            const totalNodeCount = progress.total;

                            return (
                                <Card key={execution.executionId} shadow="sm" className="hover:shadow-md transition-shadow">
                                    <CardBody className="p-3">
                                        <div className="flex items-start justify-between gap-3">
                                            {/* 左侧信息 */}
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono text-default-600">{execution.executionId.slice(0, 8)}</span>
                                                    <Chip size="sm" color={statusConfig.color} variant="flat" startContent={statusConfig.icon}>
                                                        {statusConfig.label}
                                                    </Chip>
                                                </div>

                                                <div className="text-xs text-default-500 space-y-0.5">
                                                    <div>
                                                        <Clock size={10} className="inline mr-1" />
                                                        开始: {formatTimestamp(execution.startedAt)}
                                                    </div>
                                                    <div>时长: {calculateDuration(execution.startedAt, execution.completedAt)}</div>
                                                    <div>
                                                        进度: {completedNodeCount}/{totalNodeCount} 节点
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 右侧操作 */}
                                            <Button size="sm" variant="flat" onPress={() => onLoadSnapshot(execution.executionId)}>
                                                加载快照
                                            </Button>
                                        </div>
                                    </CardBody>
                                </Card>
                            );
                        })}
                    </div>

                    {/* 分页器 */}
                    {totalPages > 1 && (
                        <div className="flex justify-center mt-3">
                            <Pagination size="sm" total={totalPages} page={currentPage} onChange={onPageChange} showControls />
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
