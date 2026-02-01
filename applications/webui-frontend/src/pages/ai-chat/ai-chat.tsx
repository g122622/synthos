/**
 * AI Chat 智能问答页面
 * 提供语义搜索、RAG 问答、Agent 对话等能力，支持历史会话记录
 * 采用现代聊天应用布局，输入框固定在底部
 */
import type { AiChatTab } from "@/types/agent";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import { DEFAULT_ACTIVE_TAB, DEFAULT_TOP_K, DEFAULT_ENABLE_QUERY_REWRITER, DEFAULT_SEARCH_LIMIT, DEFAULT_SIDEBAR_COLLAPSED } from "./constants/constants";

import DefaultLayout from "@/layouts/default";

export default function AiChatPage() {
    const { theme } = useTheme();
    const [searchParams, setSearchParams] = useSearchParams();

    // 当前 Tab（ask、search 或 agent）
    const [activeTab, setActiveTab] = useState<AiChatTab>(DEFAULT_ACTIVE_TAB as AiChatTab);

    // 问答参数
    const [question, setQuestion] = useState("");
    const [topK, setTopK] = useState(DEFAULT_TOP_K);
    const [enableQueryRewriter, setEnableQueryRewriter] = useState(DEFAULT_ENABLE_QUERY_REWRITER);

    // 历史会话状态
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(DEFAULT_SIDEBAR_COLLAPSED);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Agent：当前会话下选中的对话
    const [selectedAgentConversationId, setSelectedAgentConversationId] = useState<string | undefined>(undefined);
    const [agentRefreshTrigger, setAgentRefreshTrigger] = useState(0);

    // 标记是否已从URL初始化
    const [isInitializedFromUrl, setIsInitializedFromUrl] = useState(false);

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

    // 从URL参数初始化状态
    useEffect(() => {
        const initFromUrl = async () => {
            // 读取URL参数
            const urlTab = searchParams.get("tab");
            const urlSessionId = searchParams.get("sessionId");
            const urlConversationId = searchParams.get("conversationId");
            const urlQuestion = searchParams.get("question");
            const urlTopK = searchParams.get("topK");
            const urlEnableQueryRewriter = searchParams.get("enableQueryRewriter");
            const urlSearchQuery = searchParams.get("searchQuery");
            const urlSearchLimit = searchParams.get("searchLimit");
            const urlSidebarCollapsed = searchParams.get("sidebarCollapsed");

            // 恢复tab
            if (urlTab && (urlTab === "ask" || urlTab === "search" || urlTab === "agent")) {
                setActiveTab(urlTab as AiChatTab);
            }

            // 恢复侧边栏状态
            if (urlSidebarCollapsed !== null) {
                setSidebarCollapsed(urlSidebarCollapsed === "true");
            }

            // 恢复问答参数
            if (urlQuestion) {
                setQuestion(decodeURIComponent(urlQuestion));
            }
            if (urlTopK) {
                const topKNum = parseInt(urlTopK, 10);

                if (!isNaN(topKNum) && topKNum > 0) {
                    setTopK(topKNum);
                }
            }
            if (urlEnableQueryRewriter !== null) {
                setEnableQueryRewriter(urlEnableQueryRewriter === "true");
            }

            // 恢复搜索参数
            if (urlSearchQuery) {
                setSearchQuery(decodeURIComponent(urlSearchQuery));
            }
            if (urlSearchLimit) {
                const limitNum = parseInt(urlSearchLimit, 10);

                if (!isNaN(limitNum) && limitNum > 0) {
                    setSearchLimit(limitNum);
                }
            }

            // 恢复Agent对话ID
            if (urlConversationId) {
                setSelectedAgentConversationId(urlConversationId);
            }

            // 恢复会话ID并加载详情
            if (urlSessionId) {
                setSelectedSessionId(urlSessionId);
                // 自动加载会话详情
                await handleSelectSession(urlSessionId);
            }

            setIsInitializedFromUrl(true);
        };

        initFromUrl();
    }, [handleSelectSession]);

    // 同步状态到URL
    useEffect(() => {
        // 只有在初始化完成后才同步URL
        if (!isInitializedFromUrl) {
            return;
        }

        const newParams = new URLSearchParams();

        // tab：只有非默认值才写入
        if (activeTab !== DEFAULT_ACTIVE_TAB) {
            newParams.set("tab", activeTab);
        }

        // sessionId
        if (selectedSessionId) {
            newParams.set("sessionId", selectedSessionId);
        }

        // conversationId (Agent模式)
        if (selectedAgentConversationId) {
            newParams.set("conversationId", selectedAgentConversationId);
        }

        // question
        if (question) {
            newParams.set("question", encodeURIComponent(question));
        }

        // topK：只有非默认值才写入
        if (topK !== DEFAULT_TOP_K) {
            newParams.set("topK", String(topK));
        }

        // enableQueryRewriter：只有非默认值才写入
        if (enableQueryRewriter !== DEFAULT_ENABLE_QUERY_REWRITER) {
            newParams.set("enableQueryRewriter", String(enableQueryRewriter));
        }

        // searchQuery
        if (searchQuery) {
            newParams.set("searchQuery", encodeURIComponent(searchQuery));
        }

        // searchLimit：只有非默认值才写入
        if (searchLimit !== DEFAULT_SEARCH_LIMIT) {
            newParams.set("searchLimit", String(searchLimit));
        }

        // sidebarCollapsed：只有非默认值才写入
        if (sidebarCollapsed !== DEFAULT_SIDEBAR_COLLAPSED) {
            newParams.set("sidebarCollapsed", String(sidebarCollapsed));
        }

        setSearchParams(newParams, { replace: true });
    }, [activeTab, selectedSessionId, selectedAgentConversationId, question, topK, enableQueryRewriter, searchQuery, searchLimit, sidebarCollapsed, isInitializedFromUrl, setSearchParams]);

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
