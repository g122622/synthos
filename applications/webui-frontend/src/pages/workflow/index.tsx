/**
 * 工作流可视化编排 - 主页面
 *
 * 提供完整的工作流编辑、可视化、执行功能
 */

import type { WorkflowDefinition, ExecutionSummary } from "./types/index";

import React from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Button, Select, SelectItem, useDisclosure } from "@heroui/react";
import { Save, FolderOpen, Play, StopCircle, RotateCcw } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { WorkflowCanvas } from "./components/WorkflowCanvas";
import { PropertyPanel } from "./components/PropertyPanel";
import { NodePalette } from "./components/NodePalette";
import { WorkflowDiffModal } from "./components/WorkflowDiffModal";
import { ExecutionPanel } from "./components/ExecutionPanel";
import { useWorkflowStore } from "./stores/workflowStore";
import { fetchWorkflows, saveWorkflow, fetchWorkflowById, triggerWorkflow, cancelExecution, resumeExecution, fetchExecutionHistory, fetchExecutionById } from "./api/workflowApi";
import { useExecutionStatus, type ExecutionUpdateEvent } from "./hooks/useExecutionStatus";

import { Notification } from "@/util/Notification";

/**
 * 工作流页面组件
 */
const WorkflowPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const { getCurrentWorkflowDefinition, loadWorkflow, updateNodeStatus, setCurrentExecution } = useWorkflowStore();

    // 工作流列表和状态
    const [workflows, setWorkflows] = React.useState<WorkflowDefinition[]>([]);
    const [currentWorkflowId, setCurrentWorkflowId] = React.useState<string | null>(null);
    const [originalWorkflow, setOriginalWorkflow] = React.useState<WorkflowDefinition | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);

    // Diff 模态框
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [modifiedWorkflow, setModifiedWorkflow] = React.useState<WorkflowDefinition | null>(null);

    // 执行状态订阅
    const handleExecutionUpdate = React.useCallback(
        (event: ExecutionUpdateEvent) => {
            console.log("📡 收到执行状态更新:", event);
            updateNodeStatus(event.nodeId, event.status);
        },
        [updateNodeStatus]
    );

    const {
        executionId: currentExecutionId,
        isConnecting,
        isConnected,
        subscribe: subscribeExecution,
        unsubscribe: unsubscribeExecution
    } = useExecutionStatus(currentWorkflowId, handleExecutionUpdate);

    // 执行历史
    const [executions, setExecutions] = React.useState<ExecutionSummary[]>([]);
    const [totalExecutions, setTotalExecutions] = React.useState(0);
    const [executionPage, setExecutionPage] = React.useState(1);
    const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);
    const PAGE_SIZE = 50;

    // 加载工作流列表
    const loadWorkflowList = React.useCallback(async () => {
        try {
            const list = await fetchWorkflows();

            setWorkflows(list);
        } catch (error) {
            console.error("加载工作流列表失败:", error);
            Notification.error({ title: "加载工作流列表失败" });
        }
    }, []);

    // 从 URL 参数加载工作流
    React.useEffect(() => {
        const workflowId = searchParams.get("workflowId");

        if (workflowId && workflows.length > 0) {
            loadWorkflowById(workflowId);
        }
    }, [searchParams, workflows]);

    // 页面初始化：加载工作流列表
    React.useEffect(() => {
        loadWorkflowList();
    }, [loadWorkflowList]);

    /**
     * 加载执行历史
     */
    const loadExecutionHistory = React.useCallback(async () => {
        if (!currentWorkflowId) {
            return;
        }

        setIsLoadingHistory(true);
        try {
            const { executions: historyList, total } = await fetchExecutionHistory(currentWorkflowId, executionPage, PAGE_SIZE);

            setExecutions(historyList);
            setTotalExecutions(total);
        } catch (error) {
            console.error("加载执行历史失败:", error);
            Notification.error({ title: "加载执行历史失败" });
        } finally {
            setIsLoadingHistory(false);
        }
    }, [currentWorkflowId, executionPage]);

    // 当工作流或页码变化时，加载执行历史
    React.useEffect(() => {
        loadExecutionHistory();
    }, [loadExecutionHistory]);

    /**
     * 根据 ID 加载工作流
     */
    const loadWorkflowById = async (id: string) => {
        try {
            const workflow = await fetchWorkflowById(id);

            setCurrentWorkflowId(id);
            setOriginalWorkflow(workflow);
            loadWorkflow(workflow);
            Notification.success({ title: `已加载工作流: ${workflow.name}` });
        } catch (error) {
            console.error("加载工作流失败:", error);
            Notification.error({ title: "加载工作流失败" });
        }
    };

    /**
     * 工作流选择器变更
     */
    const handleWorkflowChange = (keys: any) => {
        const selectedId = Array.from(keys)[0] as string;

        if (!selectedId) {
            return;
        }

        setSearchParams({ workflowId: selectedId });
        loadWorkflowById(selectedId);
    };

    /**
     * 打开 Diff 预览
     */
    const handleSaveClick = () => {
        const current = getCurrentWorkflowDefinition();

        setModifiedWorkflow(current);
        onOpen();
    };

    /**
     * 确认保存
     */
    const handleConfirmSave = async () => {
        if (!modifiedWorkflow) {
            return;
        }

        setIsSaving(true);
        try {
            const saved = await saveWorkflow(modifiedWorkflow);

            setOriginalWorkflow(saved);
            setCurrentWorkflowId(saved.id);
            await loadWorkflowList(); // 刷新列表
            Notification.success({ title: "工作流保存成功" });
        } catch (error) {
            console.error("保存工作流失败:", error);
            Notification.error({ title: "保存工作流失败" });
        } finally {
            setIsSaving(false);
        }
    };

    /**
     * 手动触发工作流
     */
    const handleTrigger = async () => {
        if (!currentWorkflowId) {
            Notification.error({ title: "请先选择工作流" });

            return;
        }

        const currentDef = getCurrentWorkflowDefinition();

        if (!currentDef) {
            Notification.error({ title: "无法获取当前工作流定义" });

            return;
        }

        try {
            const executionId = await triggerWorkflow(currentWorkflowId);

            setCurrentExecution({
                executionId,
                workflowId: currentWorkflowId,
                status: "running",
                nodeStates: {},
                startedAt: Date.now(),
                snapshot: currentDef
            });
            subscribeExecution(executionId);
            Notification.success({ title: "工作流已触发", description: `执行ID: ${executionId}` });
        } catch (error) {
            console.error("触发工作流失败:", error);
            Notification.error({ title: "触发工作流失败" });
        }
    };

    /**
     * 取消执行
     */
    const handleCancel = async () => {
        if (!currentExecutionId) {
            Notification.error({ title: "当前没有正在执行的任务" });

            return;
        }

        try {
            await cancelExecution(currentExecutionId);
            unsubscribeExecution();
            Notification.success({ title: "已取消执行" });
        } catch (error) {
            console.error("取消执行失败:", error);
            Notification.error({ title: "取消执行失败" });
        }
    };

    /**
     * 断点续跑
     */
    const handleResume = async () => {
        if (!currentExecutionId) {
            Notification.error({ title: "当前没有可恢复的任务" });

            return;
        }

        try {
            await resumeExecution(currentExecutionId);
            Notification.success({ title: "已恢复执行" });
        } catch (error) {
            console.error("断点续跑失败:", error);
            Notification.error({ title: "断点续跑失败" });
        }
    };

    /**
     * 加载执行快照
     */
    const handleLoadSnapshot = async (executionId: string) => {
        try {
            const execution = await fetchExecutionById(executionId);

            loadWorkflow(execution.snapshot);

            // 恢复节点状态
            Object.entries(execution.nodeStates).forEach(([nodeId, status]) => {
                updateNodeStatus(nodeId, status);
            });

            Notification.success({
                title: "已加载执行快照",
                description: `执行ID: ${executionId.slice(0, 8)}`
            });
        } catch (error) {
            console.error("加载执行快照失败:", error);
            Notification.error({ title: "加载执行快照失败" });
        }
    };

    /**
     * 执行历史分页变更
     */
    const handlePageChange = (page: number) => {
        setExecutionPage(page);
    };

    return (
        <div className="flex flex-col h-screen w-full bg-background">
            {/* 顶部工具栏 */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-divider bg-content1 gap-4">
                <h1 className="text-lg font-semibold shrink-0">🔀 流程编排</h1>

                {/* 工作流选择器 */}
                <Select className="max-w-xs" label="当前工作流" placeholder="选择工作流" selectedKeys={currentWorkflowId ? [currentWorkflowId] : []} size="sm" onSelectionChange={handleWorkflowChange}>
                    {workflows.map(wf => (
                        <SelectItem key={wf.id}>{wf.name}</SelectItem>
                    ))}
                </Select>

                {/* 操作按钮组 */}
                <div className="flex gap-2 shrink-0">
                    <Button size="sm" startContent={<FolderOpen size={16} />} variant="flat" onPress={loadWorkflowList}>
                        刷新列表
                    </Button>
                    <Button color="primary" size="sm" startContent={<Save size={16} />} onPress={handleSaveClick}>
                        保存
                    </Button>
                    <Button color="success" isDisabled={!currentWorkflowId || isConnected} size="sm" startContent={<Play size={16} />} onPress={handleTrigger}>
                        手动触发
                    </Button>
                    <Button color="danger" isDisabled={!isConnected} size="sm" startContent={<StopCircle size={16} />} onPress={handleCancel}>
                        取消执行
                    </Button>
                    <Button color="warning" isDisabled={!currentExecutionId} size="sm" startContent={<RotateCcw size={16} />} onPress={handleResume}>
                        断点续跑
                    </Button>
                    {isConnecting && <span className="text-xs text-warning self-center">连接中...</span>}
                    {isConnected && <span className="text-xs text-success self-center">● 执行中</span>}
                </div>
            </div>

            {/* 主内容区 */}
            <div className="flex flex-1 overflow-hidden">
                {/* 左侧节点面板 */}
                <NodePalette />

                {/* 中间画布 */}
                <div className="flex-1">
                    <ReactFlowProvider>
                        <WorkflowCanvas />
                    </ReactFlowProvider>
                </div>

                {/* 右侧属性面板 */}
                <PropertyPanel />
            </div>

            {/* 底部执行面板 */}
            <div className="h-48 border-t border-divider bg-content1 p-4">
                <ExecutionPanel
                    currentPage={executionPage}
                    executions={executions}
                    isLoading={isLoadingHistory}
                    pageSize={PAGE_SIZE}
                    totalCount={totalExecutions}
                    onLoadSnapshot={handleLoadSnapshot}
                    onPageChange={handlePageChange}
                />
            </div>

            {/* Diff 预览模态框 */}
            {modifiedWorkflow && (
                <WorkflowDiffModal isOpen={isOpen} isSaving={isSaving} modifiedWorkflow={modifiedWorkflow} originalWorkflow={originalWorkflow} onClose={onClose} onConfirm={handleConfirmSave} />
            )}
        </div>
    );
};

export default WorkflowPage;
