/**
 * AI 聊天历史侧边栏组件
 * 显示历史会话列表，支持新建、选择、删除会话
 * 支持时间分组（置顶、今天、昨天等）、Tab切换和多种操作
 */
import type { ChatHistorySidebarProps, ExtendedSessionListItem } from "./types";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Drawer, DrawerContent, Divider, ScrollShadow, Spinner, Tabs, Tab, cn } from "@heroui/react";
import { ChevronLeft, MessageSquare, Plus } from "lucide-react";
import { motion } from "framer-motion";

import { AgentConversationList } from "./AgentConversationList";
import { SessionGroup } from "./SessionGroup";

import { deleteSession, getSessionList, updateSessionTitle } from "@/api/ragChatHistoryApi";
import { getAgentConversations, AgentConversation } from "@/api/agentApi";

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
    onTabChange,
    selectedAgentConversationId,
    onSelectAgentConversation,
    agentRefreshTrigger = 0
}) => {
    const [sessions, setSessions] = useState<ExtendedSessionListItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [total, setTotal] = useState(0);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState("");
    const [selectedSidebarTab, setSelectedSidebarTab] = useState<string>("all");

    // Agent conversations
    const [agentConversations, setAgentConversations] = useState<AgentConversation[]>([]);
    const [agentLoading, setAgentLoading] = useState(false);
    const [agentHasMore, setAgentHasMore] = useState(false);

    const PAGE_SIZE = 20;
    const showFullSidebar = mobile || !collapsed;

    const loadAgentConversations = useCallback(
        async (append: boolean = false, beforeUpdatedAt?: number) => {
            if (activeTab !== "agent") {
                return;
            }

            setAgentLoading(true);
            try {
                const response = await getAgentConversations(selectedSessionId || undefined, append ? beforeUpdatedAt : undefined, PAGE_SIZE);

                if (response.success && response.data) {
                    const next = response.data;

                    setAgentConversations(prev => (append ? [...prev, ...next] : next));
                    setAgentHasMore(next.length >= PAGE_SIZE);

                    if (!append && next.length > 0 && !selectedAgentConversationId) {
                        onSelectAgentConversation?.(next[0].id);
                    }
                }
            } catch (error) {
                console.error("加载 Agent 对话列表失败:", error);
            } finally {
                setAgentLoading(false);
            }
        },
        [activeTab, selectedSessionId, selectedAgentConversationId, onSelectAgentConversation]
    );

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
                        setSessions(prev => [...prev, ...response.data.sessions.map(s => ({ ...s }))]);
                    } else {
                        setSessions(response.data.sessions.map(s => ({ ...s })));
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

    const autoLoadLockRef = useRef(false);
    const autoLoadAgentLockRef = useRef(false);

    const tryAutoLoadMoreSessions = useCallback(() => {
        if (activeTab === "agent") {
            return;
        }
        if (!hasMore || loading) {
            return;
        }
        if (autoLoadLockRef.current) {
            return;
        }

        autoLoadLockRef.current = true;
        void loadSessions(true).finally(() => {
            autoLoadLockRef.current = false;
        });
    }, [activeTab, hasMore, loading, loadSessions]);

    const handleSessionListScroll = useCallback(
        (event: React.UIEvent<HTMLElement>) => {
            const el = event.currentTarget;
            const thresholdPx = 80;
            const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

            if (distanceToBottom <= thresholdPx) {
                if (activeTab === "agent") {
                    if (agentLoading || !agentHasMore || autoLoadAgentLockRef.current) {
                        return;
                    }

                    autoLoadAgentLockRef.current = true;
                    const beforeUpdatedAt = agentConversations[agentConversations.length - 1]?.updatedAt;

                    void loadAgentConversations(true, beforeUpdatedAt).finally(() => {
                        autoLoadAgentLockRef.current = false;
                    });
                } else {
                    tryAutoLoadMoreSessions();
                }
            }
        },
        [activeTab, agentConversations, agentHasMore, agentLoading, loadAgentConversations, tryAutoLoadMoreSessions]
    );

    // 初始加载和刷新
    useEffect(() => {
        loadSessions(false);
    }, [refreshTrigger]);

    // Agent: 初始加载 / 切换 session / 刷新
    useEffect(() => {
        if (activeTab !== "agent") {
            return;
        }

        setAgentConversations([]);
        setAgentHasMore(false);
        loadAgentConversations(false);
    }, [activeTab, selectedSessionId, agentRefreshTrigger, loadAgentConversations]);

    // 删除会话
    const handleDelete = async (sessionId: string) => {
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
    const handleStartEdit = (session: ExtendedSessionListItem) => {
        setEditingId(session.id);
        setEditingTitle(session.title);
    };

    // 保存标题
    const handleSaveTitle = async (sessionId: string) => {
        if (!editingTitle.trim()) {
            return;
        }

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
    const handleTogglePin = async (sessionId: string) => {
        try {
            const session = sessions.find(s => s.id === sessionId);

            if (!session) {
                return;
            }

            // 更新本地状态
            setSessions(prev => prev.map(s => (s.id === sessionId ? { ...s, pinned: !s.pinned } : s)));

            // TODO: 调用后端API更新置顶状态
            // await toggleSessionPin(sessionId, !session.pinned);
        } catch (error) {
            console.error("切换置顶状态失败:", error);
        }
    };

    // 分享会话
    const handleShare = async (sessionId: string) => {
        // TODO: 实现分享功能
        console.log("分享会话:", sessionId);
    };

    // 导出会话
    const handleExport = async (sessionId: string) => {
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

    // 侧边栏内容（注意：不要用组件形式定义在函数内部，否则每次 render 都会生成新组件类型，导致滚动容器卸载重挂载）
    const sidebarContent = (
        <div className={cn("flex h-full flex-col overflow-hidden border-r border-divider transition-[width] duration-300 ease-in-out", showFullSidebar ? "w-72" : "w-16 items-center")}>
            {/* Logo 和折叠按钮 */}
            <div className="flex w-full items-center justify-between gap-2 px-4 py-3">
                <motion.h1 animate={showFullSidebar ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }} className="text-lg font-semibold" transition={{ duration: 0.2 }}>
                    {showFullSidebar && "AI Chat"}
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
                        <Tab key="agent" title="智能Agent" />
                    </Tabs>
                    {activeTab !== "agent" && (
                        <>
                            <Divider className="my-2" />
                            <Tabs aria-label="会话筛选" className="w-full" selectedKey={selectedSidebarTab} size="sm" variant="light" onSelectionChange={key => setSelectedSidebarTab(key as string)}>
                                <Tab key="all" title="全部" />
                                <Tab key="pinned" title="置顶" />
                            </Tabs>
                        </>
                    )}
                </div>
            )}

            {/* 会话列表 */}
            {showFullSidebar && (
                <ScrollShadow className="flex-1 overflow-y-auto px-2" onScroll={handleSessionListScroll}>
                    {activeTab === "agent" ? (
                        <AgentConversationList
                            activeTab={activeTab}
                            agentConversations={agentConversations}
                            agentHasMore={agentHasMore}
                            agentLoading={agentLoading}
                            selectedAgentConversationId={selectedAgentConversationId}
                            onLoadMore={() => loadAgentConversations(true, agentConversations[agentConversations.length - 1]?.updatedAt)}
                            onSelectAgentConversation={onSelectAgentConversation}
                        />
                    ) : loading && sessions.length === 0 ? (
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
            {showFullSidebar && activeTab !== "agent" && total > 0 && <div className="p-2 border-t border-default-200 text-xs text-default-400 text-center">共 {total} 个会话</div>}
        </div>
    );

    // 移动端：使用 Drawer
    if (mobile) {
        return (
            <Drawer isOpen={mobileDrawerOpen} placement="left" onOpenChange={onMobileDrawerChange}>
                <DrawerContent>{sidebarContent}</DrawerContent>
            </Drawer>
        );
    }

    // 桌面端：直接渲染侧边栏
    return sidebarContent;
};

export default ChatHistorySidebar;
