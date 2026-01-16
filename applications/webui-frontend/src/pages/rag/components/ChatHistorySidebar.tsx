/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-autofocus */
/**
 * RAG 聊天历史侧边栏组件
 * 显示历史会话列表，支持新建、选择、删除会话
 * 支持时间分组（置顶、今天、昨天等）、Tab切换和多种操作
 */
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Button, Spinner, ScrollShadow, Input, Drawer, DrawerContent, Popover, PopoverTrigger, PopoverContent, Listbox, ListboxItem, Tabs, Tab, Divider, cn } from "@heroui/react";
import { Plus, Trash2, ChevronLeft, MessageSquare, Edit2, Check, X, Pin, PinOff, Share2, Download, MoreVertical } from "lucide-react";
import { motion } from "framer-motion";

import { getSessionList, deleteSession, updateSessionTitle, SessionListItem } from "@/api/ragChatHistoryApi";

interface ChatHistorySidebarProps {
    // 当前选中的会话ID
    selectedSessionId: string | null;
    // 选择会话的回调
    onSelectSession: (sessionId: string | null) => void;
    // 新建会话的回调
    onNewSession: () => void;
    // 侧边栏是否折叠
    collapsed: boolean;
    // 折叠状态变化回调
    onCollapsedChange: (collapsed: boolean) => void;
    // 会话列表刷新触发器
    refreshTrigger: number;
    // 是否为移动端模式
    mobile?: boolean;
    // 移动端抽屉是否打开
    mobileDrawerOpen?: boolean;
    // 移动端抽屉状态变化回调
    onMobileDrawerChange?: (open: boolean) => void;
    // 当前激活的Tab（ask或search）
    activeTab?: string;
    // Tab切换回调
    onTabChange?: (tab: string) => void;
}

/**
 * 扩展的会话项，添加置顶标记
 */
interface ExtendedSessionListItem extends SessionListItem {
    pinned?: boolean;
}

/**
 * 会话项组件
 */
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

const SessionItem: React.FC<SessionItemProps> = ({
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

/**
 * 会话分组组件
 */
interface SessionGroupProps {
    title: string;
    sessions: ExtendedSessionListItem[];
    selectedSessionId: string | null;
    editingId: string | null;
    editingTitle: string;
    onSelectSession: (id: string) => void;
    onStartEdit: (e: React.MouseEvent, session: ExtendedSessionListItem) => void;
    onSaveEdit: (e: React.MouseEvent, id: string) => void;
    onCancelEdit: () => void;
    onEditingTitleChange: (value: string) => void;
    onTogglePin: (e: React.MouseEvent, id: string) => void;
    onShare: (e: React.MouseEvent, id: string) => void;
    onExport: (e: React.MouseEvent, id: string) => void;
    onDelete: (e: React.MouseEvent, id: string) => void;
}

const SessionGroup: React.FC<SessionGroupProps> = ({
    title,
    sessions,
    selectedSessionId,
    editingId,
    editingTitle,
    onSelectSession,
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    onEditingTitleChange,
    onTogglePin,
    onShare,
    onExport,
    onDelete
}) => {
    if (sessions.length === 0) return null;

    return (
        <div className="mb-4">
            <div className="px-3 py-1 text-xs font-semibold text-default-500 uppercase">{title}</div>
            <div className="space-y-0.5">
                {sessions.map(session => (
                    <SessionItem
                        key={session.id}
                        editingTitle={editingTitle}
                        isActive={selectedSessionId === session.id}
                        isEditing={editingId === session.id}
                        session={session}
                        onCancelEdit={onCancelEdit}
                        onDelete={e => onDelete(e, session.id)}
                        onEditingTitleChange={onEditingTitleChange}
                        onExport={e => onExport(e, session.id)}
                        onSaveEdit={e => onSaveEdit(e, session.id)}
                        onSelect={() => onSelectSession(session.id)}
                        onShare={e => onShare(e, session.id)}
                        onStartEdit={e => onStartEdit(e, session)}
                        onTogglePin={e => onTogglePin(e, session.id)}
                    />
                ))}
            </div>
        </div>
    );
};

const ChatHistorySidebar: React.FC<ChatHistorySidebarProps> = ({
    selectedSessionId,
    onSelectSession,
    onNewSession,
    collapsed,
    onCollapsedChange,
    refreshTrigger,
    mobile = false,
    mobileDrawerOpen = false,
    onMobileDrawerChange,
    activeTab = "ask",
    onTabChange
}) => {
    const [sessions, setSessions] = useState<ExtendedSessionListItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [total, setTotal] = useState(0);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState("");
    const [selectedSidebarTab, setSelectedSidebarTab] = useState<string>("all");

    const PAGE_SIZE = 20;
    const showFullSidebar = mobile || !collapsed;

    // 时间分组
    const groupedSessions = useMemo(() => {
        const filteredSessions = selectedSidebarTab === "pinned" ? sessions.filter(s => s.pinned) : sessions;
        const pinnedSessions = filteredSessions.filter(s => s.pinned);
        const unpinnedSessions = filteredSessions.filter(s => !s.pinned);

        const grouped = {
            pinned: pinnedSessions,
            today: [] as ExtendedSessionListItem[],
            yesterday: [] as ExtendedSessionListItem[],
            thisWeek: [] as ExtendedSessionListItem[],
            thisMonth: [] as ExtendedSessionListItem[],
            older: [] as ExtendedSessionListItem[]
        };

        unpinnedSessions.forEach(session => {
            const date = new Date(session.updatedAt);
            const now = new Date();
            const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays === 0) {
                grouped.today.push(session);
            } else if (diffDays === 1) {
                grouped.yesterday.push(session);
            } else if (diffDays < 7) {
                grouped.thisWeek.push(session);
            } else if (diffDays < 30) {
                grouped.thisMonth.push(session);
            } else {
                grouped.older.push(session);
            }
        });

        return grouped;
    }, [sessions, selectedSidebarTab]);

    // 加载会话列表
    const loadSessions = useCallback(
        async (append: boolean = false) => {
            setLoading(true);
            try {
                const offset = append ? sessions.length : 0;
                const response = await getSessionList(PAGE_SIZE, offset);

                if (response.success) {
                    if (append) {
                        setSessions(prev => [...prev, ...response.data.sessions]);
                    } else {
                        setSessions(response.data.sessions);
                    }
                    setHasMore(response.data.hasMore);
                    setTotal(response.data.total);
                }
            } catch (error) {
                console.error("加载会话列表失败:", error);
            } finally {
                setLoading(false);
            }
        },
        [sessions.length]
    );

    // 初始加载和刷新
    useEffect(() => {
        loadSessions(false);
    }, [refreshTrigger]);

    // 删除会话
    const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        try {
            const response = await deleteSession(sessionId);

            if (response.success) {
                setSessions(prev => prev.filter(s => s.id !== sessionId));
                setTotal(prev => prev - 1);
                if (selectedSessionId === sessionId) {
                    onSelectSession(null);
                }
            }
        } catch (error) {
            console.error("删除会话失败:", error);
        }
    };

    // 开始编辑标题
    const handleStartEdit = (e: React.MouseEvent, session: ExtendedSessionListItem) => {
        e.stopPropagation();
        setEditingId(session.id);
        setEditingTitle(session.title);
    };

    // 保存标题
    const handleSaveTitle = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        if (!editingTitle.trim()) return;

        try {
            const response = await updateSessionTitle(sessionId, editingTitle.trim());

            if (response.success) {
                setSessions(prev => prev.map(s => (s.id === sessionId ? { ...s, title: editingTitle.trim() } : s)));
            }
        } catch (error) {
            console.error("更新标题失败:", error);
        } finally {
            setEditingId(null);
            setEditingTitle("");
        }
    };

    // 取消编辑
    const handleCancelEdit = () => {
        setEditingId(null);
        setEditingTitle("");
    };

    // 切换置顶状态
    const handleTogglePin = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        try {
            const session = sessions.find(s => s.id === sessionId);

            if (!session) return;

            // 更新本地状态
            setSessions(prev => prev.map(s => (s.id === sessionId ? { ...s, pinned: !s.pinned } : s)));

            // TODO: 调用后端API更新置顶状态
            // await toggleSessionPin(sessionId, !session.pinned);
        } catch (error) {
            console.error("切换置顶状态失败:", error);
        }
    };

    // 分享会话
    const handleShare = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        // TODO: 实现分享功能
        console.log("分享会话:", sessionId);
    };

    // 导出会话
    const handleExport = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        // TODO: 实现导出功能
        console.log("导出会话:", sessionId);
    };

    // 新建会话的处理
    const handleNewChat = () => {
        onNewSession();
        if (mobile && onMobileDrawerChange) {
            onMobileDrawerChange(false);
        }
    };

    // 选择会话的处理
    const handleChatSelect = (id: string) => {
        onSelectSession(id);
        if (mobile && onMobileDrawerChange) {
            onMobileDrawerChange(false);
        }
    };

    // 侧边栏内容组件
    const SidebarContent = () => (
        <div className={cn("flex h-full flex-col overflow-hidden border-r border-divider transition-[width] duration-300 ease-in-out", showFullSidebar ? "w-72" : "w-16 items-center")}>
            {/* Logo 和折叠按钮 */}
            <div className="flex w-full items-center justify-between gap-2 px-4 py-3">
                <motion.h1 animate={showFullSidebar ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }} className="text-lg font-semibold" transition={{ duration: 0.2 }}>
                    {showFullSidebar && "RAG 问答"}
                </motion.h1>
                {showFullSidebar && <div />}
                <motion.div animate={{ rotate: showFullSidebar ? 0 : 180 }} transition={{ duration: 0.3 }}>
                    {!mobile && (
                        <Button isIconOnly className="overflow-hidden" variant="light" onPress={() => onCollapsedChange(!collapsed)}>
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                    )}
                </motion.div>
            </div>

            {/* 新建会话按钮 */}
            <div className="px-4 pb-2">
                <Button className={cn("min-w-10 transition-all", showFullSidebar ? "w-full" : "w-10 p-1")} color="primary" onPress={handleNewChat}>
                    <Plus className="w-5 h-5" />
                    {showFullSidebar && <span className="ml-2">新建会话</span>}
                </Button>
            </div>

            {/* Tab 切换 - 功能模式和会话筛选 */}
            {showFullSidebar && (
                <div className="px-2 pb-2">
                    <Tabs aria-label="功能切换" className="w-full" selectedKey={activeTab} size="sm" variant="bordered" onSelectionChange={key => onTabChange?.(key as string)}>
                        <Tab key="ask" title="AI问答" />
                        <Tab key="search" title="语义搜索" />
                    </Tabs>
                    <Divider className="my-2" />
                    <Tabs aria-label="会话筛选" className="w-full" selectedKey={selectedSidebarTab} size="sm" variant="light" onSelectionChange={key => setSelectedSidebarTab(key as string)}>
                        <Tab key="all" title="全部" />
                        <Tab key="pinned" title="置顶" />
                    </Tabs>
                </div>
            )}

            {/* 会话列表 */}
            {showFullSidebar && (
                <ScrollShadow className="flex-1 overflow-y-auto px-2">
                    {loading && sessions.length === 0 ? (
                        <div className="flex justify-center py-8">
                            <Spinner size="sm" />
                        </div>
                    ) : sessions.length === 0 ? (
                        <motion.div animate={{ opacity: 1, y: 0 }} className="text-center py-8 text-default-400 text-sm" initial={{ opacity: 0, y: 10 }} transition={{ duration: 0.3 }}>
                            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>暂无历史会话</p>
                            <p className="text-xs mt-1">开始提问后会自动保存</p>
                        </motion.div>
                    ) : (
                        <>
                            <SessionGroup
                                editingId={editingId}
                                editingTitle={editingTitle}
                                selectedSessionId={selectedSessionId}
                                sessions={groupedSessions.pinned}
                                title="置顶"
                                onCancelEdit={handleCancelEdit}
                                onDelete={handleDelete}
                                onEditingTitleChange={setEditingTitle}
                                onExport={handleExport}
                                onSaveEdit={handleSaveTitle}
                                onSelectSession={handleChatSelect}
                                onShare={handleShare}
                                onStartEdit={handleStartEdit}
                                onTogglePin={handleTogglePin}
                            />
                            <SessionGroup
                                editingId={editingId}
                                editingTitle={editingTitle}
                                selectedSessionId={selectedSessionId}
                                sessions={groupedSessions.today}
                                title="今天"
                                onCancelEdit={handleCancelEdit}
                                onDelete={handleDelete}
                                onEditingTitleChange={setEditingTitle}
                                onExport={handleExport}
                                onSaveEdit={handleSaveTitle}
                                onSelectSession={handleChatSelect}
                                onShare={handleShare}
                                onStartEdit={handleStartEdit}
                                onTogglePin={handleTogglePin}
                            />
                            <SessionGroup
                                editingId={editingId}
                                editingTitle={editingTitle}
                                selectedSessionId={selectedSessionId}
                                sessions={groupedSessions.yesterday}
                                title="昨天"
                                onCancelEdit={handleCancelEdit}
                                onDelete={handleDelete}
                                onEditingTitleChange={setEditingTitle}
                                onExport={handleExport}
                                onSaveEdit={handleSaveTitle}
                                onSelectSession={handleChatSelect}
                                onShare={handleShare}
                                onStartEdit={handleStartEdit}
                                onTogglePin={handleTogglePin}
                            />
                            <SessionGroup
                                editingId={editingId}
                                editingTitle={editingTitle}
                                selectedSessionId={selectedSessionId}
                                sessions={groupedSessions.thisWeek}
                                title="本周"
                                onCancelEdit={handleCancelEdit}
                                onDelete={handleDelete}
                                onEditingTitleChange={setEditingTitle}
                                onExport={handleExport}
                                onSaveEdit={handleSaveTitle}
                                onSelectSession={handleChatSelect}
                                onShare={handleShare}
                                onStartEdit={handleStartEdit}
                                onTogglePin={handleTogglePin}
                            />
                            <SessionGroup
                                editingId={editingId}
                                editingTitle={editingTitle}
                                selectedSessionId={selectedSessionId}
                                sessions={groupedSessions.thisMonth}
                                title="本月"
                                onCancelEdit={handleCancelEdit}
                                onDelete={handleDelete}
                                onEditingTitleChange={setEditingTitle}
                                onExport={handleExport}
                                onSaveEdit={handleSaveTitle}
                                onSelectSession={handleChatSelect}
                                onShare={handleShare}
                                onStartEdit={handleStartEdit}
                                onTogglePin={handleTogglePin}
                            />
                            <SessionGroup
                                editingId={editingId}
                                editingTitle={editingTitle}
                                selectedSessionId={selectedSessionId}
                                sessions={groupedSessions.older}
                                title="更早"
                                onCancelEdit={handleCancelEdit}
                                onDelete={handleDelete}
                                onEditingTitleChange={setEditingTitle}
                                onExport={handleExport}
                                onSaveEdit={handleSaveTitle}
                                onSelectSession={handleChatSelect}
                                onShare={handleShare}
                                onStartEdit={handleStartEdit}
                                onTogglePin={handleTogglePin}
                            />

                            {/* 加载更多 */}
                            {hasMore && (
                                <Button className="w-full mt-2 mb-2" isLoading={loading} size="sm" variant="flat" onPress={() => loadSessions(true)}>
                                    加载更多
                                </Button>
                            )}
                        </>
                    )}
                </ScrollShadow>
            )}

            {/* 底部统计 */}
            {showFullSidebar && total > 0 && <div className="p-2 border-t border-default-200 text-xs text-default-400 text-center">共 {total} 个会话</div>}
        </div>
    );

    // 移动端：使用 Drawer
    if (mobile) {
        return (
            <Drawer isOpen={mobileDrawerOpen} placement="left" onOpenChange={onMobileDrawerChange}>
                <DrawerContent>
                    <SidebarContent />
                </DrawerContent>
            </Drawer>
        );
    }

    // 桌面端：直接渲染侧边栏
    return <SidebarContent />;
};

export default ChatHistorySidebar;
