/**
 * AI Chat 智能问答页面
 * 提供语义搜索、RAG 问答、Agent 对话等能力，支持历史会话记录
 * 采用现代聊天应用布局，输入框固定在底部
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { Menu } from "lucide-react";
import { useTheme } from "@heroui/use-theme";

import ChatHistorySidebar from "./components/ChatHistorySidebar/ChatHistorySidebar";
import { AgentChat } from "./components/AgentChat";
import EmptyState from "./components/EmptyState";
import ScrollFloatButtons from "./components/ScrollFloatButtons";
import AskPanel from "./components/panels/AskPanel";
import SearchPanel from "./components/panels/SearchPanel";
import AskInputBar from "./components/inputs/AskInputBar";
import SearchInputBar from "./components/inputs/SearchInputBar";
import { useAskState } from "./components/hooks/useAskState";
import { useMobileLayout } from "./components/hooks/useMobileLayout";
import { useSemanticSearch } from "./components/hooks/useSemanticSearch";
import { useSessionActions } from "./components/hooks/useSessionActions";
import { useTopicStatus } from "./components/hooks/useTopicStatus";

import DefaultLayout from "@/layouts/default";

type AiChatTab = "ask" | "search" | "agent";

export default function AiChatPage() {
    const { theme } = useTheme();

    // 当前 Tab（ask、search 或 agent）
    const [activeTab, setActiveTab] = useState<AiChatTab>("ask");

    // 问答参数
    const [question, setQuestion] = useState("");
    const [topK, setTopK] = useState(100);
    const [enableQueryRewriter, setEnableQueryRewriter] = useState(true);

    // 历史会话状态
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Agent：当前会话下选中的对话
    const [selectedAgentConversationId, setSelectedAgentConversationId] = useState<string | undefined>(undefined);
    const [agentRefreshTrigger, setAgentRefreshTrigger] = useState(0);

    // 移动端状态
    const { isMobile, mobileDrawerOpen, setMobileDrawerOpen } = useMobileLayout();

    // 话题收藏/已读
    const { favoriteTopics, readTopics, loadTopicStatuses, markAsRead, toggleFavorite } = useTopicStatus();

    // 流式问答
    const { askResponse, setAskResponse, askLoading, currentSessionIsFailed, setCurrentSessionIsFailed, currentSessionFailReason, setCurrentSessionFailReason, handleAsk, stopAsk } = useAskState({
        onReferences: refs => {
            const topicIds = refs.map(r => r.topicId);

            void loadTopicStatuses(topicIds);
        },
        onDone: chunk => {
            if (chunk.sessionId) {
                setSelectedSessionId(chunk.sessionId);
                setRefreshTrigger(prev => prev + 1);
            }
        }
    });

    // 语义搜索
    const { searchQuery, setSearchQuery, searchLimit, setSearchLimit, searchLoading, searchResults, handleSearch, resetSearch } = useSemanticSearch();

    // refs
    const answerCardRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const mainContentRef = useRef<HTMLDivElement>(null);

    // 自动滚动到底部
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    // 滚动到顶部
    const scrollToTop = useCallback(() => {
        mainContentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, []);

    // 进入页面时滚动到顶部
    useEffect(() => {
        const t = setTimeout(() => {
            scrollToTop();
        }, 100);

        return () => clearTimeout(t);
    }, [scrollToTop]);

    const { handleNewSession, handleSelectSession } = useSessionActions({
        activeTab,
        isMobile,
        loadTopicStatuses,
        resetSearch,
        setActiveTab,
        setAgentRefreshTrigger,
        setAskResponse,
        setCurrentSessionFailReason,
        setCurrentSessionIsFailed,
        setEnableQueryRewriter,
        setMobileDrawerOpen,
        setQuestion,
        setSelectedAgentConversationId,
        setSelectedSessionId,
        setTopK,
        stopAsk
    });

    const renderMainContent = () => {
        if (activeTab === "ask") {
            if (askResponse) {
                return (
                    <AskPanel
                        answerCardRef={answerCardRef}
                        askLoading={askLoading}
                        askResponse={askResponse}
                        currentSessionFailReason={currentSessionFailReason}
                        currentSessionIsFailed={currentSessionIsFailed}
                        favoriteTopics={favoriteTopics}
                        readTopics={readTopics}
                        theme={theme}
                        onMarkAsRead={markAsRead}
                        onToggleFavorite={toggleFavorite}
                    />
                );
            }

            return <EmptyState mode="ask" />;
        }

        if (activeTab === "agent") {
            return null;
        }

        return (
            <SearchPanel
                favoriteTopics={favoriteTopics}
                readTopics={readTopics}
                searchLoading={searchLoading}
                searchQuery={searchQuery}
                searchResults={searchResults}
                onMarkAsRead={markAsRead}
                onToggleFavorite={toggleFavorite}
            />
        );
    };

    return (
        <DefaultLayout>
            <div className="flex h-[calc(100vh-115px)] overflow-hidden">
                {/* 移动端菜单按钮 */}
                {isMobile && (
                    <Button isIconOnly className="fixed left-4 top-20 z-30 md:hidden" size="sm" variant="flat" onPress={() => setMobileDrawerOpen(true)}>
                        <Menu className="w-5 h-5" />
                    </Button>
                )}

                {/* 历史会话侧边栏 */}
                <ChatHistorySidebar
                    activeTab={activeTab}
                    agentRefreshTrigger={agentRefreshTrigger}
                    collapsed={sidebarCollapsed}
                    mobile={isMobile}
                    mobileDrawerOpen={mobileDrawerOpen}
                    refreshTrigger={refreshTrigger}
                    selectedAgentConversationId={selectedAgentConversationId}
                    selectedSessionId={selectedSessionId}
                    onCollapsedChange={setSidebarCollapsed}
                    onMobileDrawerChange={setMobileDrawerOpen}
                    onNewSession={handleNewSession}
                    onSelectAgentConversation={setSelectedAgentConversationId}
                    onSelectSession={handleSelectSession}
                    onTabChange={t => setActiveTab(t as AiChatTab)}
                />

                {/* 主内容区 */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Agent 模式使用独立渲染 */}
                    {activeTab === "agent" ? (
                        <AgentChat
                            conversationId={selectedAgentConversationId}
                            sessionId={selectedSessionId || undefined}
                            onConversationIdChange={cid => {
                                setSelectedAgentConversationId(cid);
                                setAgentRefreshTrigger(prev => prev + 1);
                            }}
                        />
                    ) : (
                        <>
                            {/* 消息显示区 */}
                            <div ref={mainContentRef} className="flex-1 overflow-y-auto p-10">
                                <div ref={answerCardRef} className="mx-auto">
                                    {renderMainContent()}
                                    <div ref={messagesEndRef} />
                                </div>
                            </div>

                            {/* 底部输入区 */}
                            <div className="px-4 py-2 md:px-4 md:py-4 border-t border-default-200">
                                {activeTab === "ask" ? (
                                    <AskInputBar
                                        askLoading={askLoading}
                                        enableQueryRewriter={enableQueryRewriter}
                                        question={question}
                                        topK={topK}
                                        onAsk={() => {
                                            void handleAsk({ question, topK, enableQueryRewriter });
                                            scrollToBottom();
                                        }}
                                        onEnableQueryRewriterChange={setEnableQueryRewriter}
                                        onQuestionChange={setQuestion}
                                        onTopKChange={setTopK}
                                    />
                                ) : (
                                    <SearchInputBar
                                        searchLimit={searchLimit}
                                        searchLoading={searchLoading}
                                        searchQuery={searchQuery}
                                        onSearch={() => {
                                            void handleSearch();
                                            scrollToBottom();
                                        }}
                                        onSearchLimitChange={setSearchLimit}
                                        onSearchQueryChange={setSearchQuery}
                                    />
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* 滚动悬浮按钮 */}
                <ScrollFloatButtons onScrollToBottom={scrollToBottom} onScrollToTop={scrollToTop} />
            </div>
        </DefaultLayout>
    );
}
