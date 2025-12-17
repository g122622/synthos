/**
 * RAG 智能问答页面
 * 提供语义搜索和 AI 问答功能，支持历史会话记录
 */
import { useState, useCallback } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input, Textarea } from "@heroui/input";
import { Tabs, Tab } from "@heroui/tabs";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { Link } from "@heroui/link";
import { Search, MessageSquare, Sparkles, BookOpen, Users } from "lucide-react";

import ChatHistorySidebar from "./components/ChatHistorySidebar";

import DefaultLayout from "@/layouts/default";
import { title, subtitle } from "@/components/primitives";
import { search, ask, SearchResultItem, AskResponse, ReferenceItem } from "@/api/ragApi";
import { getTopicsFavoriteStatus, getTopicsReadStatus } from "@/api/readAndFavApi";
import { createSession, getSessionDetail } from "@/api/ragChatHistoryApi";
import TopicPopover from "@/components/TopicPopover";
import MarkdownRenderer from "@/components/MarkdownRenderer";

export default function RagPage() {
    // 搜索状态
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchLimit, setSearchLimit] = useState(10);

    // 问答状态
    const [question, setQuestion] = useState("");
    const [askResponse, setAskResponse] = useState<AskResponse | null>(null);
    const [askLoading, setAskLoading] = useState(false);
    const [topK, setTopK] = useState(5);

    // 当前 Tab
    const [activeTab, setActiveTab] = useState("search");

    // 收藏和已读状态
    const [favoriteTopics, setFavoriteTopics] = useState<Record<string, boolean>>({});
    const [readTopics, setReadTopics] = useState<Record<string, boolean>>({});

    // 历史会话状态
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // 处理问答
    const handleAsk = useCallback(async () => {
        if (!question.trim()) return;

        setAskLoading(true);
        try {
            const response = await ask(question, topK);

            if (response.success) {
                setAskResponse(response.data);

                // 保存到历史记录
                try {
                    await createSession(question, response.data.answer, response.data.references, topK);
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
    const handleSelectSession = useCallback(async (sessionId: string | null) => {
        setSelectedSessionId(sessionId);

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
                    // 切换到问答 Tab
                    setActiveTab("ask");

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
    }, []);

    // 新建会话
    const handleNewSession = useCallback(() => {
        setSelectedSessionId(null);
        setQuestion("");
        setAskResponse(null);
        setActiveTab("ask");
    }, []);

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

    // 渲染搜索结果卡片
    const renderSearchResultCard = (item: SearchResultItem, index: number) => (
        <TopicPopover key={item.topicId} favoriteTopics={favoriteTopics} readTopics={readTopics} topicId={item.topicId} onMarkAsRead={markAsRead} onToggleFavorite={toggleFavorite}>
            <Card key={item.topicId} className="w-full mb-4">
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
                    <Chip color={item.distance < 0.3 ? "success" : item.distance < 0.5 ? "warning" : "default"} size="sm" variant="flat">
                        相关度: {Math.round((1 - item.distance) * 100)}%
                    </Chip>
                </CardHeader>
                <CardBody>
                    <p className="text-default-600">{item.detail}</p>
                    <div className="flex justify-end mt-2">
                        <Link className="text-primary text-sm" href={`/ai-digest?topicId=${item.topicId}`}>
                            查看详情 →
                        </Link>
                    </div>
                </CardBody>
            </Card>
        </TopicPopover>
    );

    // 渲染问答结果
    const renderAskResult = () => {
        if (!askResponse) return null;

        return (
            <div className="space-y-4">
                {/* AI 回答 */}
                <Card className="w-full">
                    <CardHeader className="flex gap-3 pl-7 pt-5">
                        <Sparkles className="w-6 h-6 text-primary" />
                        <div className="flex flex-col">
                            <p className="text-lg font-semibold">AI 回答</p>
                            <p className="text-small text-default-500">基于群聊记录生成</p>
                        </div>
                    </CardHeader>
                    <CardBody className="p-7 pt-3">
                        <MarkdownRenderer content={askResponse.answer} />
                    </CardBody>
                </Card>

                {/* 参考来源 */}
                {askResponse.references.length > 0 && (
                    <Card className="w-full">
                        <CardHeader className="flex gap-3">
                            <BookOpen className="w-6 h-6 text-secondary" />
                            <div className="flex flex-col">
                                <p className="text-lg font-semibold">参考来源</p>
                                <p className="text-small text-default-500">共 {askResponse.references.length} 个相关话题</p>
                            </div>
                        </CardHeader>
                        <CardBody>
                            <Accordion variant="bordered">
                                {askResponse.references.map((ref, index) => (
                                    <AccordionItem
                                        key={ref.topicId}
                                        aria-label={ref.topic}
                                        startContent={
                                            <Chip color="secondary" size="sm" variant="flat">
                                                #{index + 1}
                                            </Chip>
                                        }
                                        title={
                                            <div className="flex items-center justify-between w-full pr-4">
                                                <TopicPopover favoriteTopics={favoriteTopics} readTopics={readTopics} topicId={ref.topicId} onMarkAsRead={markAsRead} onToggleFavorite={toggleFavorite}>
                                                    <span className="cursor-pointer">{ref.topic}</span>
                                                </TopicPopover>
                                                <Chip color={ref.relevance > 0.8 ? "success" : ref.relevance > 0.6 ? "warning" : "default"} size="sm" variant="flat">
                                                    相关度: {Math.round(ref.relevance * 100)}%
                                                </Chip>
                                            </div>
                                        }
                                    >
                                        <div className="flex justify-between items-center">
                                            <div>在话题标题上悬停以查看详情</div>
                                            <Link className="text-primary text-sm" href={`/ai-digest?topicId=${ref.topicId}`}>
                                                查看话题详情 →
                                            </Link>
                                        </div>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </CardBody>
                    </Card>
                )}
            </div>
        );
    };

    return (
        <DefaultLayout>
            <div className="flex h-[calc(100vh-64px)]">
                {/* 历史会话侧边栏 */}
                <ChatHistorySidebar
                    collapsed={sidebarCollapsed}
                    refreshTrigger={refreshTrigger}
                    selectedSessionId={selectedSessionId}
                    onCollapsedChange={setSidebarCollapsed}
                    onNewSession={handleNewSession}
                    onSelectSession={handleSelectSession}
                />

                {/* 主内容区 */}
                <div className="flex-1 overflow-y-auto">
                    <section className="flex flex-col items-center justify-start gap-4 py-8 md:py-10 px-4">
                        {/* 标题区域 */}
                        <div className="inline-block max-w-2xl text-center justify-center">
                            <h1 className={title()}>RAG&nbsp;</h1>
                            <h1 className={title({ color: "violet" })}>智能问答</h1>
                            <div className={subtitle({ class: "mt-4" })}>基于群聊记录的语义搜索和 AI 问答系统，帮你快速找到相关话题或获取智能回答</div>
                        </div>

                        {/* Tab 切换 */}
                        <div className="w-full max-w-4xl mt-6">
                            <Tabs
                                aria-label="RAG功能选项"
                                classNames={{
                                    tabList: "w-full justify-center"
                                }}
                                color="primary"
                                selectedKey={activeTab}
                                variant="bordered"
                                onSelectionChange={key => setActiveTab(key as string)}
                            >
                                {/* 搜索 Tab */}
                                <Tab
                                    key="search"
                                    title={
                                        <div className="flex items-center gap-2">
                                            <Search className="w-4 h-4" />
                                            <span>语义搜索</span>
                                        </div>
                                    }
                                >
                                    <div className="mt-6 space-y-6">
                                        {/* 搜索输入区 */}
                                        <Card className="w-full">
                                            <CardBody className="gap-4">
                                                <div className="flex gap-4 flex-col sm:flex-row">
                                                    <Input
                                                        className="flex-1"
                                                        placeholder="输入搜索内容，如：React 性能优化"
                                                        size="lg"
                                                        startContent={<Search className="w-4 h-4 text-default-400" />}
                                                        value={searchQuery}
                                                        onChange={e => setSearchQuery(e.target.value)}
                                                        onKeyDown={e => e.key === "Enter" && handleSearch()}
                                                    />
                                                    <Input
                                                        className="w-full sm:w-28"
                                                        label="结果数量"
                                                        max={50}
                                                        min={1}
                                                        size="lg"
                                                        type="number"
                                                        value={searchLimit.toString()}
                                                        onChange={e => setSearchLimit(parseInt(e.target.value) || 10)}
                                                    />
                                                </div>
                                                <Button
                                                    className="w-full sm:w-auto"
                                                    color="primary"
                                                    isLoading={searchLoading}
                                                    size="lg"
                                                    startContent={!searchLoading && <Search className="w-4 h-4" />}
                                                    onClick={handleSearch}
                                                >
                                                    搜索
                                                </Button>
                                            </CardBody>
                                        </Card>

                                        {/* 搜索结果 */}
                                        {searchLoading && (
                                            <div className="flex justify-center py-8">
                                                <Spinner label="搜索中..." size="lg" />
                                            </div>
                                        )}

                                        {!searchLoading && searchResults.length > 0 && (
                                            <div>
                                                <h3 className="text-lg font-semibold mb-4">找到 {searchResults.length} 个相关话题</h3>
                                                {searchResults.map((item, index) => renderSearchResultCard(item, index))}
                                            </div>
                                        )}

                                        {!searchLoading && searchQuery && searchResults.length === 0 && <div className="text-center py-8 text-default-500">未找到相关话题，请尝试其他关键词</div>}
                                    </div>
                                </Tab>

                                {/* 问答 Tab */}
                                <Tab
                                    key="ask"
                                    title={
                                        <div className="flex items-center gap-2">
                                            <MessageSquare className="w-4 h-4" />
                                            <span>AI 问答</span>
                                        </div>
                                    }
                                >
                                    <div className="mt-6 space-y-6">
                                        {/* 问答输入区 */}
                                        <Card className="w-full">
                                            <CardBody className="gap-4">
                                                <Textarea
                                                    minRows={3}
                                                    placeholder="输入你的问题，如：React 18 有哪些新特性？群友们是怎么看的？"
                                                    size="lg"
                                                    value={question}
                                                    onChange={e => setQuestion(e.target.value)}
                                                />
                                                <div className="flex gap-4 items-end flex-col sm:flex-row">
                                                    <Input
                                                        className="w-full sm:w-32"
                                                        label="参考话题数"
                                                        max={50}
                                                        min={1}
                                                        size="lg"
                                                        type="number"
                                                        value={topK.toString()}
                                                        onChange={e => setTopK(parseInt(e.target.value) || 5)}
                                                    />
                                                    <Button
                                                        className="w-full sm:w-auto"
                                                        color="secondary"
                                                        isLoading={askLoading}
                                                        size="lg"
                                                        startContent={!askLoading && <Sparkles className="w-4 h-4" />}
                                                        onClick={handleAsk}
                                                    >
                                                        获取 AI 回答
                                                    </Button>
                                                </div>
                                            </CardBody>
                                        </Card>

                                        {/* 问答结果 */}
                                        {askLoading && (
                                            <div className="flex justify-center py-8">
                                                <Spinner label="AI 正在思考中..." size="lg" />
                                            </div>
                                        )}

                                        {!askLoading && askResponse && renderAskResult()}

                                        {!askLoading && question && !askResponse && <div className="text-center py-8 text-default-500">点击 &quot;获取 AI 回答&quot; 按钮开始问答</div>}
                                    </div>
                                </Tab>
                            </Tabs>
                        </div>

                        {/* 功能说明 */}
                        <div className="w-full max-w-4xl mt-8">
                            <Card className="w-full bg-default-50">
                                <CardBody>
                                    <h3 className="text-lg font-semibold mb-3">💡 使用说明</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-default-600">
                                        <div>
                                            <p className="font-medium mb-1">🔍 语义搜索</p>
                                            <p>输入关键词或自然语言描述，系统会找出语义最相关的群聊话题。支持模糊匹配和同义词理解。</p>
                                        </div>
                                        <div>
                                            <p className="font-medium mb-1">💬 AI 问答</p>
                                            <p>直接提问，AI 会基于群聊记录中的相关内容生成回答，并列出参考来源。历史会话会自动保存在左侧。</p>
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                        </div>
                    </section>
                </div>
            </div>
        </DefaultLayout>
    );
}
