/**
 * 画布右键菜单组件
 *
 * 支持节点/边的删除、复制等操作
 */

import React from "react";
import { Card, CardBody } from "@heroui/react";
import { Copy, Trash2 } from "lucide-react";

export interface ContextMenuProps {
    /**
     * 菜单位置
     */
    position: { x: number; y: number };

    /**
     * 目标类型
     */
    targetType: "node" | "edge" | "pane";

    /**
     * 目标 ID
     */
    targetId?: string;

    /**
     * 关闭菜单回调
     */
    onClose: () => void;

    /**
     * 删除回调
     */
    onDelete?: () => void;

    /**
     * 复制回调（仅节点）
     */
    onCopy?: () => void;
}

/**
 * 右键菜单组件
 */
export const ContextMenu: React.FC<ContextMenuProps> = ({ position, targetType, onClose, onDelete, onCopy }) => {
    React.useEffect(() => {
        const handleClick = () => onClose();
        document.addEventListener("click", handleClick);
        return () => document.removeEventListener("click", handleClick);
    }, [onClose]);

    if (targetType === "pane") {
        return null; // 画布空白处不显示菜单
    }

    return (
        <Card className="fixed z-50 min-w-40" style={{ left: position.x, top: position.y }} shadow="lg">
            <CardBody className="p-1">
                <ul className="space-y-1">
                    {targetType === "node" && onCopy && (
                        <li>
                            <button
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-default-100 rounded-md transition-colors"
                                onClick={e => {
                                    e.stopPropagation();
                                    onCopy();
                                    onClose();
                                }}
                            >
                                <Copy size={14} />
                                <span>复制节点</span>
                            </button>
                        </li>
                    )}
                    {onDelete && (
                        <li>
                            <button
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger-50 rounded-md transition-colors"
                                onClick={e => {
                                    e.stopPropagation();
                                    onDelete();
                                    onClose();
                                }}
                            >
                                <Trash2 size={14} />
                                <span>删除{targetType === "node" ? "节点" : "连线"}</span>
                            </button>
                        </li>
                    )}
                </ul>
            </CardBody>
        </Card>
    );
};
