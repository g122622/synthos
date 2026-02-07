/**
 * 工作流执行状态 Hook
 *
 * 通过 Server-Sent Events (SSE) 订阅实时执行状态更新
 */

import type { NodeExecutionStatus } from "../types/index";

import React from "react";

/**
 * 执行状态更新事件
 */
export interface ExecutionUpdateEvent {
    /**
     * 执行 ID
     */
    executionId: string;

    /**
     * 节点 ID
     */
    nodeId: string;

    /**
     * 节点状态
     */
    status: NodeExecutionStatus;

    /**
     * 更新时间
     */
    timestamp: number;

    /**
     * 错误信息（如果失败）
     */
    error?: string;
}

/**
 * 执行状态 Hook 返回值
 */
export interface UseExecutionStatusReturn {
    /**
     * 当前执行 ID
     */
    executionId: string | null;

    /**
     * 是否正在连接
     */
    isConnecting: boolean;

    /**
     * 是否已连接
     */
    isConnected: boolean;

    /**
     * 开始订阅
     */
    subscribe: (executionId: string) => void;

    /**
     * 取消订阅
     */
    unsubscribe: () => void;
}

/**
 * 工作流执行状态订阅 Hook
 *
 * @param workflowId - 工作流 ID
 * @param onUpdate - 状态更新回调
 * @returns 订阅控制器
 */
export const useExecutionStatus = (workflowId: string | null, onUpdate: (event: ExecutionUpdateEvent) => void): UseExecutionStatusReturn => {
    const [executionId, setExecutionId] = React.useState<string | null>(null);
    const [isConnecting, setIsConnecting] = React.useState(false);
    const [isConnected, setIsConnected] = React.useState(false);
    const eventSourceRef = React.useRef<EventSource | null>(null);

    /**
     * 开始订阅执行状态
     */
    const subscribe = React.useCallback(
        (execId: string) => {
            if (!workflowId) {
                console.warn("⚠️ 未选择工作流，无法订阅");

                return;
            }

            // 关闭旧连接
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }

            setExecutionId(execId);
            setIsConnecting(true);

            const url = `/api/workflow/execution/${execId}/subscribe`;
            const eventSource = new EventSource(url);

            eventSource.onopen = () => {
                console.log("✅ 执行状态订阅已建立:", execId);
                setIsConnecting(false);
                setIsConnected(true);
            };

            eventSource.onmessage = e => {
                try {
                    const event: ExecutionUpdateEvent = JSON.parse(e.data);

                    onUpdate(event);
                } catch (error) {
                    console.error("❌ 解析执行状态事件失败:", error);
                }
            };

            eventSource.onerror = error => {
                console.error("❌ 执行状态订阅错误:", error);
                setIsConnecting(false);
                setIsConnected(false);
                eventSource.close();
            };

            eventSourceRef.current = eventSource;
        },
        [workflowId, onUpdate]
    );

    /**
     * 取消订阅
     */
    const unsubscribe = React.useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
            setExecutionId(null);
            setIsConnected(false);
            console.log("✅ 执行状态订阅已取消");
        }
    }, []);

    // 组件卸载时清理连接
    React.useEffect(() => {
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, []);

    return {
        executionId,
        isConnecting,
        isConnected,
        subscribe,
        unsubscribe
    };
};
