/**
 * RAG 智能问答页面
 * 提供语义搜索和 AI 问答功能，支持历史会话记录
 * 采用现代聊天应用布局，输入框固定在底部
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { Button, Checkbox, cn } from "@heroui/react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input, Textarea } from "@heroui/input";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Link } from "@heroui/link";
import { Progress } from "@heroui/react";
import { Search, Users, Download, Menu, Send, ChevronUp, ChevronDown } from "lucide-react";
import domtoimage from "dom-to-image";
import { motion } from "framer-motion";
import { useTheme } from "@heroui/use-theme";

import ChatHistorySidebar from "./components/ChatHistorySidebar";
import ReferenceList from "./components/ReferenceList";
import { AgentChat } from "./components/AgentChat";

import DefaultLayout from "@/layouts/default";
import { search, ask, SearchResultItem, AskResponse, ReferenceItem } from "@/api/ragApi";
import { getTopicsFavoriteStatus, getTopicsReadStatus } from "@/api/readAndFavApi";
import { createSession, getSessionDetail } from "@/api/ragChatHistoryApi";
import TopicPopover from "@/components/topic/TopicPopover";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import TypingText from "@/components/TypingText";

export default function RagPage() {
    const { theme } = useTheme();

    // 搜索状态
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchLimit, setSearchLimit] = useState(10);

    // 问答状态
    const [question, setQuestion] = useState("");
    const [askResponse, setAskResponse] = useState<AskResponse | null>(null);
    const [askLoading, setAskLoading] = useState(false);
    const [topK, setTopK] = useState(100);
    const [enableQueryRewriter, setEnableQueryRewriter] = useState(true);
    const [showTypingEffect, setShowTypingEffect] = useState(false);

    // 当前 Tab（ask、search 或 agent）
    const [activeTab, setActiveTab] = useState("ask");

    // 收藏和已读状态
    const [favoriteTopics, setFavoriteTopics] = useState<Record<string, boolean>>({});
    const [readTopics, setReadTopics] = useState<Record<string, boolean>>({});

    // 历史会话状态
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Agent：当前会话下选中的对话
    const [selectedAgentConversationId, setSelectedAgentConversationId] = useState<string | undefined>(undefined);
    const [agentRefreshTrigger, setAgentRefreshTrigger] = useState(0);

    // 移动端状态
    const [isMobile, setIsMobile] = useState(false);
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

    // 检测屏幕尺寸
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkMobile();
        window.addEventListener("resize", checkMobile);

        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    // 卡片引用
    const answerCardRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const mainContentRef = useRef<HTMLDivElement>(null);

    // 自动滚动到底部
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // 滚动到顶部
    const scrollToTop = () => {
        mainContentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    };

    useEffect(() => {
        if (askResponse || searchResults.length > 0) {
            // scrollToBottom();
        }
    }, [askResponse, searchResults]);

    // 进入页面时滚动到顶部
    useEffect(() => {
        setTimeout(() => {
            scrollToTop();
        }, 100);
    }, []);

    // 处理问答
    const handleAsk = useCallback(async () => {
        if (!question.trim()) return;

        setAskLoading(true);
        setShowTypingEffect(false);
        try {
            const response = await ask(question, topK, enableQueryRewriter);

            if (response.success) {
                setAskResponse(response.data);

                // 保存到历史记录
                try {
                    await createSession(question, response.data.answer, response.data.references, topK, enableQueryRewriter);
                    // 刷新侧边栏
                    setRefreshTrigger(prev => prev + 1);
                } catch (error) {
                    console.error("保存历史记录失败:", error);
                }

                // 获取话题的收藏和已读状态
                const topicIds = response.data.references.map(ref => ref.topicId);

                if (topicIds.length > 0) {
                    try {
                        const [favoriteRes, readRes] = await Promise.all([getTopicsFavoriteStatus(topicIds), getTopicsReadStatus(topicIds)]);

                        if (favoriteRes.success && favoriteRes.data) {
                            setFavoriteTopics(prev => ({ ...prev, ...favoriteRes.data }));
                        }

                        if (readRes.success && readRes.data) {
                            setReadTopics(prev => ({ ...prev, ...readRes.data }));
                        }
                    } catch (error) {
                        console.error("获取话题状态失败:", error);
                    }
                }
            } else {
                console.error("问答失败:", response.message);
            }
        } catch (error) {
            console.error("问答出错:", error);
        } finally {
            setAskLoading(false);
        }
    }, [question, topK]);

    // 处理搜索
    const handleSearch = useCallback(async () => {
        if (!searchQuery.trim()) return;

        setSearchLoading(true);
        try {
            const response = await search(searchQuery, searchLimit);

            if (response.success) {
                setSearchResults(response.data);
            } else {
                console.error("搜索失败:", response.message);
            }
        } catch (error) {
            console.error("搜索出错:", error);
        } finally {
            setSearchLoading(false);
        }
    }, [searchQuery, searchLimit]);

    // 选择历史会话
    const handleSelectSession = useCallback(
        async (sessionId: string | null) => {
            setSelectedSessionId(sessionId);
            setSelectedAgentConversationId(undefined);

            if (sessionId) {
                try {
                    const response = await getSessionDetail(sessionId);

                    if (response.success && response.data) {
                        const session = response.data;

                        setQuestion(session.question);
                        setAskResponse({
                            answer: session.answer,
                            references: session.references
                        });
                        setTopK(session.topK);
                        setEnableQueryRewriter(session.enableQueryRewriter);
                        setShowTypingEffect(false);
                        // 仅在非 Agent 模式下切换到问答 Tab
                        if (activeTab !== "agent") {
                            setActiveTab("ask");
                        }
                        // 移动端关闭抽屉
                        if (isMobile) {
                            setMobileDrawerOpen(false);
                        }

                        // 获取话题的收藏和已读状态
                        const topicIds = session.references.map((ref: ReferenceItem) => ref.topicId);

                        if (topicIds.length > 0) {
                            try {
                                const [favoriteRes, readRes] = await Promise.all([getTopicsFavoriteStatus(topicIds), getTopicsReadStatus(topicIds)]);

                                if (favoriteRes.success && favoriteRes.data) {
                                    setFavoriteTopics(prev => ({ ...prev, ...favoriteRes.data }));
                                }

                                if (readRes.success && readRes.data) {
                                    setReadTopics(prev => ({ ...prev, ...readRes.data }));
                                }
                            } catch (error) {
                                console.error("获取话题状态失败:", error);
                            }
                        }
                    }
                } catch (error) {
                    console.error("加载会话详情失败:", error);
                }
            }
        },
        [isMobile, activeTab]
    );

    // 新建会话
    const handleNewSession = useCallback(() => {
        setSelectedSessionId(null);
        setSelectedAgentConversationId(undefined);
        setQuestion("");
        setAskResponse(null);
        setSearchQuery("");
        setSearchResults([]);
        setShowTypingEffect(false);
        // 移动端关闭抽屉
        if (isMobile) {
            setMobileDrawerOpen(false);
        }
    }, [isMobile]);

    // 切换收藏状态
    const toggleFavorite = useCallback((topicId: string) => {
        setFavoriteTopics(prev => ({
            ...prev,
            [topicId]: !prev[topicId]
        }));
    }, []);

    // 标记为已读
    const markAsRead = useCallback((topicId: string) => {
        setReadTopics(prev => ({
            ...prev,
            [topicId]: true
        }));
    }, []);

    // 保存为图片
    const handleSaveAsImage = useCallback(async () => {
        if (!answerCardRef.current) return;

        try {
            const dataUrl = await domtoimage.toPng(answerCardRef.current, {
                quality: 1.0,
                bgcolor: theme === "dark" ? "#1e1e1e" : "#ffffff"
            });

            const link = document.createElement("a");

            link.download = `AI回答_${new Date().getTime()}.png`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error("保存图片失败:", error);
        }
    }, []);

    // 渲染搜索结果卡片
    const renderSearchResultCard = (item: SearchResultItem, index: number) => (
        <motion.div key={item.topicId} animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 20 }} transition={{ duration: 0.3, delay: index * 0.1 }}>
            <TopicPopover key={item.topicId} favoriteTopics={favoriteTopics} readTopics={readTopics} topicId={item.topicId} onMarkAsRead={markAsRead} onToggleFavorite={toggleFavorite}>
                <Card className="w-full mb-4 hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader className="flex gap-3 pb-0">
                        <div className="flex flex-col flex-1">
                            <div className="flex items-center gap-2">
                                <Chip color="primary" size="sm" variant="flat">
                                    #{index + 1}
                                </Chip>
                                <p className="text-lg font-semibold">{item.topic}</p>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <Users className="w-4 h-4 text-default-400" />
                                <p className="text-small text-default-500">{item.contributors}</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <Chip color={item.distance < 0.3 ? "success" : item.distance < 0.5 ? "warning" : "default"} size="sm" variant="flat">
                                {Math.round((1 - item.distance) * 100)}%
                            </Chip>
                        </div>
                    </CardHeader>
                    <CardBody>
                        <p className="text-default-600 mb-2">{item.detail}</p>
                        <Progress
                            aria-label="相关度"
                            className="max-w-full"
                            color={item.distance < 0.3 ? "success" : item.distance < 0.5 ? "warning" : "default"}
                            size="sm"
                            value={Math.round((1 - item.distance) * 100)}
                        />
                        <div className="flex justify-end mt-2">
                            <Link className="text-primary text-sm" href={`/ai-digest?topicId=${item.topicId}`}>
                                查看详情 →
                            </Link>
                        </div>
                    </CardBody>
                </Card>
            </TopicPopover>
        </motion.div>
    );

    // 渲染问答结果
    const renderAskResult = () => {
        if (!askResponse) return null;

        return (
            <motion.div animate={{ opacity: 1, y: 0 }} className="space-y-4" initial={{ opacity: 0, y: 20 }} transition={{ duration: 0.4 }}>
                {/* AI 回答 */}

                {showTypingEffect ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                        <TypingText enabled={showTypingEffect} speed={20} text={askResponse.answer} onComplete={() => setShowTypingEffect(false)} />
                    </div>
                ) : (
                    <MarkdownRenderer content={askResponse.answer} showCopyButton={false} />
                )}
                <div className="flex gap-2 mt-4">
                    <Button color="primary" size="sm" startContent={<Download className="w-4 h-4" />} variant="flat" onClick={handleSaveAsImage}>
                        保存为图片
                    </Button>
                </div>

                {/* 参考来源 - 使用新的平铺展示组件 */}
                <ReferenceList favoriteTopics={favoriteTopics} readTopics={readTopics} references={askResponse.references} onMarkAsRead={markAsRead} onToggleFavorite={toggleFavorite} />
            </motion.div>
        );
    };

    // 渲染空状态
    const renderEmptyState = () => {
        if (activeTab === "ask") {
            return (
                <motion.div
                    animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                    className="text-center py-12"
                    initial={{ opacity: 0, filter: "blur(10px)", y: 20 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                >
                    <div
                        className="
                            bg-gradient-to-r from-warning-600 via-primary-600 to-secondary-600
                            bg-[length:200%_auto] animate-[gradient_3s_ease-in-out_infinite]
                            bg-clip-text text-transparent
                            text-3xl md:text-4xl font-bold mb-4
                        "
                        style={{
                            backgroundSize: "200% auto",
                            animation: "gradient 3s ease-in-out infinite"
                        }}
                    >
                        开始提问，获取智能回答
                    </div>
                    <p className="text-default-500 text-sm md:text-base">基于群聊记录，AI 将为您提供准确的答案和参考来源</p>
                </motion.div>
            );
        } else {
            return (
                <motion.div
                    animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                    className="text-center py-12"
                    initial={{ opacity: 0, filter: "blur(10px)", y: 20 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                >
                    <div
                        className="
                            bg-gradient-to-r from-primary-600 via-secondary-600 to-success-600
                            bg-[length:200%_auto] animate-[gradient_3s_ease-in-out_infinite]
                            bg-clip-text text-transparent
                            text-3xl md:text-4xl font-bold mb-4
                        "
                        style={{
                            backgroundSize: "200% auto",
                            animation: "gradient 3s ease-in-out infinite"
                        }}
                    >
                        语义搜索
                    </div>
                    <p className="text-default-500 text-sm md:text-base">输入关键词或自然语言描述，找出语义最相关的群聊话题</p>
                </motion.div>
            );
        }
    };

    // 渲染主内容区
    const renderMainContent = () => {
        if (activeTab === "ask") {
            if (askLoading) {
                return (
                    <motion.div animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-12 gap-4" initial={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                        <Spinner color="primary" size="lg" />
                        <p className="text-default-500">AI 正在思考中...</p>
                    </motion.div>
                );
            }

            if (askResponse) {
                return renderAskResult();
            }

            return renderEmptyState();
        } else if (activeTab === "agent") {
            // Agent 模式 - 直接返回 null，AgentChat 组件独立渲染
            return null;
        } else {
            // 搜索模式
            if (searchLoading) {
                return (
                    <motion.div animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-12 gap-4" initial={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                        <Spinner color="primary" size="lg" />
                        <p className="text-default-500">搜索中...</p>
                    </motion.div>
                );
            }

            if (searchResults.length > 0) {
                return (
                    <div>
                        <motion.h3 animate={{ opacity: 1, x: 0 }} className="text-lg font-semibold mb-4" initial={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                            找到 {searchResults.length} 个相关话题
                        </motion.h3>
                        {searchResults.map((item, index) => renderSearchResultCard(item, index))}
                    </div>
                );
            }

            if (searchQuery && !searchLoading) {
                return (
                    <motion.div animate={{ opacity: 1, y: 0 }} className="text-center py-12" initial={{ opacity: 0, y: 20 }} transition={{ duration: 0.3 }}>
                        <p className="text-default-500">未找到相关话题，请尝试其他关键词</p>
                    </motion.div>
                );
            }

            return renderEmptyState();
        }
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
                    onTabChange={setActiveTab}
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
                                    /* AI问答输入框 */
                                    <form
                                        className={cn(
                                            "relative w-full rounded-medium bg-default-100",
                                            "flex flex-col items-start",
                                            "transition-border border-2 border-default-300 focus-within:border-primary"
                                        )}
                                        onSubmit={e => {
                                            e.preventDefault();
                                            handleAsk();
                                        }}
                                    >
                                        <Textarea
                                            className="w-full"
                                            classNames={{
                                                inputWrapper: "!bg-transparent shadow-none",
                                                input: "pt-2 pl-3 pb-12 !pr-3 text-medium"
                                            }}
                                            maxRows={5}
                                            minRows={2}
                                            placeholder="输入你的问题，如：React 18 有哪些新特性？群友们是怎么看的？"
                                            value={question}
                                            variant="flat"
                                            onKeyDown={e => {
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleAsk();
                                                }
                                            }}
                                            onValueChange={setQuestion}
                                        />

                                        <div className="flex w-full items-center justify-between px-3 pb-3">
                                            <div className="flex items-center gap-2">
                                                Top-K:
                                                <Input
                                                    className="w-35"
                                                    max={100}
                                                    min={1}
                                                    size="sm"
                                                    type="number"
                                                    value={topK.toString()}
                                                    variant="bordered"
                                                    onChange={e => setTopK(parseInt(e.target.value) || 100)}
                                                />
                                                <Checkbox className="ml-2" isSelected={enableQueryRewriter} size="md" onValueChange={setEnableQueryRewriter}>
                                                    查询扩展
                                                </Checkbox>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <div className="text-xs text-default-400">{question.length > 0 ? `${question.length} 字符` : ""}</div>
                                                <Button
                                                    isIconOnly
                                                    color={question.trim() ? "primary" : "default"}
                                                    isDisabled={!question.trim() || askLoading}
                                                    isLoading={askLoading}
                                                    size="sm"
                                                    type="submit"
                                                >
                                                    <Send className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </form>
                                ) : (
                                    /* 语义搜索输入框 */
                                    <form
                                        className={cn(
                                            "relative w-full rounded-medium bg-default-100",
                                            "flex flex-col items-start",
                                            "transition-border border-2 border-default-300 focus-within:border-primary"
                                        )}
                                        onSubmit={e => {
                                            e.preventDefault();
                                            handleSearch();
                                        }}
                                    >
                                        <Input
                                            className="w-full"
                                            classNames={{
                                                inputWrapper: "!bg-transparent shadow-none",
                                                input: "pt-3 pl-3 pb-3 !pr-3 text-medium"
                                            }}
                                            placeholder="输入搜索内容，如：React 性能优化"
                                            startContent={<Search className="w-5 h-5 text-default-400" />}
                                            value={searchQuery}
                                            variant="flat"
                                            onKeyDown={e => e.key === "Enter" && handleSearch()}
                                            onValueChange={setSearchQuery}
                                        />

                                        <div className="flex w-full items-center justify-between px-3 pb-3 pt-2">
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    className="w-28"
                                                    label="结果数量"
                                                    max={50}
                                                    min={1}
                                                    size="sm"
                                                    type="number"
                                                    value={searchLimit.toString()}
                                                    variant="bordered"
                                                    onChange={e => setSearchLimit(parseInt(e.target.value) || 10)}
                                                />
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Button
                                                    isIconOnly
                                                    color={searchQuery.trim() ? "primary" : "default"}
                                                    isDisabled={!searchQuery.trim() || searchLoading}
                                                    isLoading={searchLoading}
                                                    size="sm"
                                                    type="submit"
                                                >
                                                    <Search className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* 滚动悬浮按钮 */}
                <div className="fixed right-4 top-1/2 transform -translate-y-1/2 flex flex-col gap-2 z-20">
                    <Button isIconOnly className="bg-default-100 hover:bg-default-200 shadow-lg" size="sm" variant="flat" onClick={scrollToTop}>
                        <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button isIconOnly className="bg-default-100 hover:bg-default-200 shadow-lg" size="sm" variant="flat" onClick={scrollToBottom}>
                        <ChevronDown className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </DefaultLayout>
    );
}
