/**
 * 工作流 Diff 预览模态框
 *
 * 保存前展示新旧工作流定义的差异，参考 config-panel 的 DiffEditor 模式
 */

import React from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@heroui/react";
import { DiffEditor } from "@monaco-editor/react";
import { useTheme } from "@heroui/use-theme";
import type { WorkflowDefinition } from "../types/index";

export interface WorkflowDiffModalProps {
    /**
     * 是否显示模态框
     */
    isOpen: boolean;

    /**
     * 关闭模态框回调
     */
    onClose: () => void;

    /**
     * 原工作流定义（数据库中的版本）
     */
    originalWorkflow: WorkflowDefinition | null;

    /**
     * 修改后的工作流定义
     */
    modifiedWorkflow: WorkflowDefinition;

    /**
     * 确认保存回调
     */
    onConfirm: () => Promise<void>;

    /**
     * 是否正在保存
     */
    isSaving?: boolean;
}

/**
 * 工作流 Diff 预览模态框组件
 */
export const WorkflowDiffModal: React.FC<WorkflowDiffModalProps> = ({ isOpen, onClose, originalWorkflow, modifiedWorkflow, onConfirm, isSaving = false }) => {
    const { theme } = useTheme();

    const originalJson = React.useMemo(() => (originalWorkflow ? JSON.stringify(originalWorkflow, null, 2) : ""), [originalWorkflow]);

    const modifiedJson = React.useMemo(() => JSON.stringify(modifiedWorkflow, null, 2), [modifiedWorkflow]);

    const handleConfirm = async () => {
        await onConfirm();
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="5xl" scrollBehavior="inside" backdrop="blur" isDismissable={!isSaving} hideCloseButton={isSaving}>
            <ModalContent>
                <>
                    <ModalHeader className="flex flex-col gap-1">
                        <h3 className="text-xl font-semibold">工作流变更预览</h3>
                        <p className="text-sm text-default-500">{originalWorkflow ? "对比数据库中的版本" : "新建工作流"}</p>
                    </ModalHeader>
                    <ModalBody>
                        <div className="h-[60vh] border border-default-200 rounded-md overflow-hidden">
                            <DiffEditor
                                height="100%"
                                language="json"
                                original={originalJson}
                                modified={modifiedJson}
                                theme={theme === "dark" ? "vs-dark" : "vs"}
                                options={{
                                    readOnly: true,
                                    minimap: { enabled: false },
                                    scrollBeyondLastLine: false,
                                    renderSideBySide: true,
                                    diffCodeLens: true,
                                    hideUnchangedRegions: {
                                        enabled: true
                                    }
                                }}
                            />
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button color="danger" variant="light" onPress={onClose} isDisabled={isSaving}>
                            取消
                        </Button>
                        <Button color="primary" onPress={handleConfirm} isLoading={isSaving}>
                            确认保存
                        </Button>
                    </ModalFooter>
                </>
            </ModalContent>
        </Modal>
    );
};
