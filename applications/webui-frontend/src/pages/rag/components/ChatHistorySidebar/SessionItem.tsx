/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-autofocus */
/**
 * 会话项组件
 */
import type { ExtendedSessionListItem } from "./types";

import React, { useState } from "react";
import { Button, Input, Popover, PopoverContent, PopoverTrigger, Listbox, ListboxItem, cn } from "@heroui/react";
import { Check, Edit2, MessageSquare, MoreVertical, Pin, PinOff, Share2, Trash2, X, Download } from "lucide-react";

interface SessionItemProps {
    session: ExtendedSessionListItem;
    isActive: boolean;
    isEditing: boolean;
    editingTitle: string;
    onSelect: () => void;
    onStartEdit: (e: React.MouseEvent) => void;
    onSaveEdit: (e: React.MouseEvent) => void;
    onCancelEdit: () => void;
    onEditingTitleChange: (value: string) => void;
    onTogglePin: (e: React.MouseEvent) => void;
    onShare: (e: React.MouseEvent) => void;
    onExport: (e: React.MouseEvent) => void;
    onDelete: (e: React.MouseEvent) => void;
}

export const SessionItem: React.FC<SessionItemProps> = ({
    session,
    isActive,
    isEditing,
    editingTitle,
    onSelect,
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    onEditingTitleChange,
    onTogglePin,
    onShare,
    onExport,
    onDelete
}) => {
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);

    // 格式化时间
    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
        } else if (days === 1) {
            return "昨天";
        } else if (days < 7) {
            return `${days}天前`;
        } else {
            return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
        }
    };

    return (
        <div className="group relative mb-1">
            <div className={cn("relative flex cursor-pointer items-center rounded-md p-2 transition-colors", isActive ? "bg-primary-100" : "hover:bg-default-100")} onClick={onSelect}>
                <div className={cn("mr-3 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full", isActive ? "bg-primary-50" : "bg-default-200")}>
                    <MessageSquare className="w-4 h-4" />
                </div>
                <div className="flex-1 overflow-hidden">
                    {isEditing ? (
                        <div className="flex items-center gap-1">
                            <Input
                                autoFocus
                                className="flex-1"
                                size="sm"
                                value={editingTitle}
                                onChange={e => onEditingTitleChange(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === "Enter") {
                                        onSaveEdit(e as unknown as React.MouseEvent);
                                    } else if (e.key === "Escape") {
                                        onCancelEdit();
                                    }
                                }}
                            />
                            <Button
                                isIconOnly
                                color="success"
                                size="sm"
                                variant="light"
                                onPress={() => {
                                    const fakeEvent = {} as React.MouseEvent;

                                    onSaveEdit(fakeEvent);
                                }}
                            >
                                <Check className="w-3 h-3" />
                            </Button>
                            <Button isIconOnly size="sm" variant="light" onPress={onCancelEdit}>
                                <X className="w-3 h-3" />
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between">
                                <p className="truncate text-sm font-medium pr-8">{session.title}</p>
                                {session.pinned && <Pin className="w-3 h-3 text-primary absolute right-2 top-2" />}
                            </div>
                            <p className="truncate text-xs text-default-500 mt-0.5">{formatTime(session.updatedAt)}</p>
                        </>
                    )}
                </div>
            </div>

            {/* 更多操作按钮 */}
            {!isEditing && (
                <Popover isOpen={isPopoverOpen} placement="right-start" onOpenChange={setIsPopoverOpen}>
                    <PopoverTrigger>
                        <Button
                            isIconOnly
                            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                            size="sm"
                            variant="light"
                            onPress={() => setIsPopoverOpen(!isPopoverOpen)}
                        >
                            <MoreVertical className="w-4 h-4" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-1">
                        <Listbox aria-label="会话操作">
                            <ListboxItem
                                key="pin"
                                startContent={session.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                                onPress={() => {
                                    const fakeEvent = {} as React.MouseEvent;

                                    onTogglePin(fakeEvent);
                                    setIsPopoverOpen(false);
                                }}
                            >
                                {session.pinned ? "取消置顶" : "置顶"}
                            </ListboxItem>
                            <ListboxItem
                                key="edit"
                                startContent={<Edit2 className="w-4 h-4" />}
                                onPress={() => {
                                    const fakeEvent = {} as React.MouseEvent;

                                    onStartEdit(fakeEvent);
                                    setIsPopoverOpen(false);
                                }}
                            >
                                编辑标题
                            </ListboxItem>
                            <ListboxItem
                                key="share"
                                startContent={<Share2 className="w-4 h-4" />}
                                onPress={() => {
                                    const fakeEvent = {} as React.MouseEvent;

                                    onShare(fakeEvent);
                                    setIsPopoverOpen(false);
                                }}
                            >
                                分享
                            </ListboxItem>
                            <ListboxItem
                                key="export"
                                startContent={<Download className="w-4 h-4" />}
                                onPress={() => {
                                    const fakeEvent = {} as React.MouseEvent;

                                    onExport(fakeEvent);
                                    setIsPopoverOpen(false);
                                }}
                            >
                                导出
                            </ListboxItem>
                            <ListboxItem
                                key="delete"
                                className="text-danger"
                                color="danger"
                                startContent={<Trash2 className="w-4 h-4" />}
                                onPress={() => {
                                    const fakeEvent = {} as React.MouseEvent;

                                    onDelete(fakeEvent);
                                    setIsPopoverOpen(false);
                                }}
                            >
                                删除
                            </ListboxItem>
                        </Listbox>
                    </PopoverContent>
                </Popover>
            )}
        </div>
    );
};
