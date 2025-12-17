/* eslint-disable jsx-a11y/no-autofocus */
/**
 * RAG 聊天历史侧边栏组件
 * 显示历史会话列表，支持新建、选择、删除会话
 */
import React, { useEffect, useState, useCallback } from "react";
import { Button, Card, CardBody, Spinner, ScrollShadow, Tooltip, Input } from "@heroui/react";
import { Plus, Trash2, ChevronLeft, ChevronRight, MessageSquare, Edit2, Check, X } from "lucide-react";

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
}

const ChatHistorySidebar: React.FC<ChatHistorySidebarProps> = ({ selectedSessionId, onSelectSession, onNewSession, collapsed, onCollapsedChange, refreshTrigger }) => {
    const [sessions, setSessions] = useState<SessionListItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [total, setTotal] = useState(0);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState("");

    const PAGE_SIZE = 20;

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
    const handleStartEdit = (e: React.MouseEvent, session: SessionListItem) => {
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

    // 折叠状态的侧边栏
    if (collapsed) {
        return (
            <div className="flex flex-col items-center py-4 px-2 bg-default-50 border-r border-default-200 h-full">
                <Tooltip content="展开侧边栏" placement="right">
                    <Button isIconOnly size="sm" variant="light" onPress={() => onCollapsedChange(false)}>
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </Tooltip>
                <Tooltip content="新建会话" placement="right">
                    <Button isIconOnly className="mt-4" color="primary" size="sm" variant="flat" onPress={onNewSession}>
                        <Plus className="w-4 h-4" />
                    </Button>
                </Tooltip>
                <div className="mt-4 text-xs text-default-400 writing-vertical">{total} 个会话</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-64 bg-default-50 border-r border-default-200 h-full">
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-default-200">
                <h3 className="text-sm font-semibold">历史会话</h3>
                <div className="flex gap-1">
                    <Tooltip content="新建会话">
                        <Button isIconOnly size="sm" variant="light" onPress={onNewSession}>
                            <Plus className="w-4 h-4" />
                        </Button>
                    </Tooltip>
                    <Tooltip content="折叠侧边栏">
                        <Button isIconOnly size="sm" variant="light" onPress={() => onCollapsedChange(true)}>
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                    </Tooltip>
                </div>
            </div>

            {/* 会话列表 */}
            <ScrollShadow className="flex-1 overflow-y-auto p-2">
                {loading && sessions.length === 0 ? (
                    <div className="flex justify-center py-8">
                        <Spinner size="sm" />
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="text-center py-8 text-default-400 text-sm">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>暂无历史会话</p>
                        <p className="text-xs mt-1">开始提问后会自动保存</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {sessions.map(session => (
                            <Card
                                key={session.id}
                                className={`cursor-pointer transition-colors ${selectedSessionId === session.id ? "bg-primary-100 border-primary-300" : "hover:bg-default-100"}`}
                                isPressable={editingId !== session.id}
                                shadow="none"
                                onPress={() => editingId !== session.id && onSelectSession(session.id)}
                            >
                                <CardBody className="p-2">
                                    {editingId === session.id ? (
                                        <div className="flex items-center gap-1">
                                            <Input
                                                autoFocus
                                                className="flex-1"
                                                size="sm"
                                                value={editingTitle}
                                                onChange={e => setEditingTitle(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === "Enter") {
                                                        handleSaveTitle(e as unknown as React.MouseEvent, session.id);
                                                    } else if (e.key === "Escape") {
                                                        handleCancelEdit();
                                                    }
                                                }}
                                            />
                                            <Button isIconOnly color="success" size="sm" variant="light" onPress={e => handleSaveTitle(e as unknown as React.MouseEvent, session.id)}>
                                                <Check className="w-3 h-3" />
                                            </Button>
                                            <Button isIconOnly size="sm" variant="light" onPress={() => handleCancelEdit()}>
                                                <X className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-start justify-between group">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{session.title}</p>
                                                <p className="text-xs text-default-400 mt-1">{formatTime(session.updatedAt)}</p>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Tooltip content="编辑标题">
                                                    <Button isIconOnly size="sm" variant="light" onPress={e => handleStartEdit(e as unknown as React.MouseEvent, session)}>
                                                        <Edit2 className="w-3 h-3" />
                                                    </Button>
                                                </Tooltip>
                                                <Tooltip content="删除会话">
                                                    <Button isIconOnly color="danger" size="sm" variant="light" onPress={e => handleDelete(e as unknown as React.MouseEvent, session.id)}>
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                </Tooltip>
                                            </div>
                                        </div>
                                    )}
                                </CardBody>
                            </Card>
                        ))}

                        {/* 加载更多 */}
                        {hasMore && (
                            <Button className="w-full mt-2" isLoading={loading} size="sm" variant="flat" onPress={() => loadSessions(true)}>
                                加载更多
                            </Button>
                        )}
                    </div>
                )}
            </ScrollShadow>

            {/* 底部统计 */}
            {total > 0 && <div className="p-2 border-t border-default-200 text-xs text-default-400 text-center">共 {total} 个会话</div>}
        </div>
    );
};

export default ChatHistorySidebar;
