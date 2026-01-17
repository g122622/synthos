import type React from "react";
import type { SessionListItem } from "@/api/ragChatHistoryApi";

export interface ChatHistorySidebarProps {
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
    // 当前激活的Tab（ask或search或agent）
    activeTab?: string;
    // Tab切换回调
    onTabChange?: (tab: string) => void;

    // Agent：当前选中的对话
    selectedAgentConversationId?: string;
    // Agent：选择对话回调
    onSelectAgentConversation?: (conversationId: string | undefined) => void;
    // Agent：刷新触发器
    agentRefreshTrigger?: number;
}

/**
 * 扩展的会话项，添加置顶标记
 */
export interface ExtendedSessionListItem extends SessionListItem {
    pinned?: boolean;
}

export type MouseEventHandler = (e: React.MouseEvent) => void;
