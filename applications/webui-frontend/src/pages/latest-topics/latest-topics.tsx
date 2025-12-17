import { useState, useEffect, useMemo } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Pagination } from "@heroui/pagination";
import { Spinner } from "@heroui/spinner";
import { Chip } from "@heroui/chip";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { DateRangePicker, Tooltip, Input, Checkbox } from "@heroui/react";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { Button as HeroUIButton } from "@heroui/button";
import { MoreVertical, Check, Copy, Search, Star } from "lucide-react";
import { today, getLocalTimeZone } from "@internationalized/date";
import { Slider } from "@heroui/slider"; // 引入Slider组件

import { generateColorFromName, parseContributors, generateColorFromInterestScore } from "./utils/utils";
import TopicItem from "./types/TopicItem";
import EnhancedDetail from "./components/EnhancedDetail";

import { getGroupDetails, getSessionIdsByGroupIdsAndTimeRange, getSessionTimeDurations, getAIDigestResultsBySessionIds } from "@/api/basicApi";
import { getInterestScoreResults } from "@/api/interestScoreApi";
import { markTopicAsRead, getTopicsReadStatus, markTopicAsFavorite, removeTopicFromFavorites, getTopicsFavoriteStatus } from "@/api/readAndFavApi";
import { title } from "@/components/primitives";
import DefaultLayout from "@/layouts/default";
import { Notification } from "@/util/Notification";
import ResponsivePopover from "@/components/ResponsivePopover";
import throttle from "@/util/throttle";

export default function LatestTopicsPage() {
    const [topics, setTopics] = useState<TopicItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [page, setPage] = useState<number>(1);
    const [topicsPerPage, setTopicsPerPage] = useState<number>(6); // 将topicsPerPage改为状态
    const [readTopics, setReadTopics] = useState<Record<string, boolean>>({});
    const [favoriteTopics, setFavoriteTopics] = useState<Record<string, boolean>>({}); // 收藏状态
    const [interestScores, setInterestScores] = useState<Record<string, number>>({}); // 兴趣得分状态

    // 筛选状态
    const [filterRead, setFilterRead] = useState<boolean>(true); // 过滤已读
    const [filterFavorite, setFilterFavorite] = useState<boolean>(false); // 筛选收藏
    const [sortByInterest, setSortByInterest] = useState<boolean>(false); // 按兴趣度排序
    const [searchText, setSearchText] = useState<string>(""); // 全文搜索

    // 默认时间范围
    const [dateRange, setDateRange] = useState({
        start: today(getLocalTimeZone()).subtract({ days: 1 }),
        end: today(getLocalTimeZone()).add({ days: 1 })
    });

    // 加载收藏状态
    useEffect(() => {
        const loadFavoriteStatus = async () => {
            if (topics.length === 0) return;

            try {
                const topicIds = topics.map(topic => topic.topicId);
                const status = await getTopicsFavoriteStatus(topicIds);

                setFavoriteTopics(status.data.favoriteStatus);
            } catch (error) {
                console.error("Failed to load favorite status:", error);
            }
        };

        loadFavoriteStatus();
    }, [topics]);

    // 初始化已读状态
    useEffect(() => {
        const initReadStatus = async () => {
            if (topics.length === 0) return;

            try {
                const topicIds = topics.map(topic => topic.topicId);
                const readStatus = await getTopicsReadStatus(topicIds);

                setReadTopics(readStatus.data.readStatus);
            } catch (error) {
                console.error("初始化已读状态失败:", error);
            }
        };

        initReadStatus();
    }, [topics]);

    const fetchLatestTopicsRaw = async (start: Date, end: Date) => {
        setLoading(true);
        try {
            const groupResponse = await getGroupDetails();

            if (!groupResponse.success) throw new Error(groupResponse.message);

            const groupIds = Object.keys(groupResponse.data);
            const [startTime, endTime] = [start.getTime(), end.getTime()];
            // 获取 sessionId -> groupId 映射
            const sessionId2GroupIdMap = new Map(
                (await getSessionIdsByGroupIdsAndTimeRange(groupIds, startTime, endTime)).data.flatMap(({ groupId, sessionIds }) => sessionIds.map(sessionId => [sessionId, groupId]))
            );

            // 获取会话时间范围
            const sessionWithDuration = (await getSessionTimeDurations(Array.from(sessionId2GroupIdMap.keys()))).data.map(item => ({
                ...item,
                groupId: sessionId2GroupIdMap.get(item.sessionId) || ""
            }));

            sessionWithDuration.sort((a, b) => b.timeEnd - a.timeEnd); // 按结束时间降序排序

            // 获取话题数据
            const sessionId2DurationMap = new Map(sessionWithDuration.map(item => [item.sessionId, { timeStart: item.timeStart, timeEnd: item.timeEnd }]));
            const digestResponse = await getAIDigestResultsBySessionIds(Array.from(new Set(sessionWithDuration.map(item => item.sessionId))));
            const topicsWithScores = digestResponse.data.flatMap(item =>
                item.result.map(topic => ({
                    ...topic,
                    timeStart: sessionId2DurationMap.get(item.sessionId)!.timeStart,
                    timeEnd: sessionId2DurationMap.get(item.sessionId)!.timeEnd,
                    groupId: sessionId2GroupIdMap.get(item.sessionId) || ""
                }))
            );

            // 获取兴趣得分
            const scoreMap = (await getInterestScoreResults(topicsWithScores.map(t => t.topicId))).data.reduce(
                (acc, { topicId, score }) => {
                    if (score !== null) acc[topicId] = score;

                    return acc;
                },
                {} as Record<string, number>
            );

            setInterestScores(scoreMap);
            setTopics(topicsWithScores);
        } catch (error) {
            console.error("获取最新话题失败:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchLatestTopics = throttle(fetchLatestTopicsRaw, 1000);

    // 初始加载 + 日期变化时重新加载
    useEffect(() => {
        const start = dateRange.start.toDate(getLocalTimeZone());
        const end = dateRange.end.toDate(getLocalTimeZone());

        fetchLatestTopics(start, end);
    }, [dateRange]);

    // 当筛选条件改变时，重置页码
    useEffect(() => {
        setPage(1);
    }, [filterRead, filterFavorite, searchText, dateRange]);

    // 应用筛选器
    const filteredTopics = topics.filter(topic => {
        // 过滤已读
        if (filterRead && readTopics[topic.topicId]) {
            return false;
        }

        // 筛选收藏
        if (filterFavorite && !favoriteTopics[topic.topicId]) {
            return false;
        }

        // 全文搜索
        if (searchText) {
            const searchTextLower = searchText.toLowerCase();
            const topicMatch = topic?.topic?.toLowerCase()?.includes(searchTextLower);
            const detailMatch = topic?.detail?.toLowerCase()?.includes(searchTextLower);
            const contributorsArray = parseContributors(topic?.contributors);
            const contributorMatch = contributorsArray.some(contributor => contributor.toLowerCase().includes(searchTextLower));
            const groupIdMatch = topic?.groupId?.toLowerCase()?.includes(searchTextLower);
            const sessionIdMatch = topic?.sessionId?.toLowerCase()?.includes(searchTextLower);

            return topicMatch || detailMatch || contributorMatch || groupIdMatch || sessionIdMatch;
        }

        return true;
    });

    // 分页处理
    const totalPages = Math.ceil(filteredTopics.length / topicsPerPage);

    // 如果按兴趣度排序，则对filteredTopics进行排序
    const sortedTopics = useMemo(() => {
        if (!sortByInterest) {
            return filteredTopics;
        }

        return [...filteredTopics].sort((a, b) => {
            const scoreA = interestScores[a.topicId];
            const scoreB = interestScores[b.topicId];

            // 如果两个话题都有兴趣得分，按得分降序排列
            if (scoreA !== undefined && scoreB !== undefined) {
                return scoreB - scoreA;
            }

            // 如果只有A有得分，A排在前面
            if (scoreA !== undefined && scoreB === undefined) {
                return -1;
            }

            // 如果只有B有得分，B排在前面
            if (scoreA === undefined && scoreB !== undefined) {
                return 1;
            }

            // 如果都没有得分，保持原有顺序
            return 0;
        });
    }, [filteredTopics, sortByInterest, interestScores]);

    const currentPageTopics = sortedTopics.slice((page - 1) * topicsPerPage, page * topicsPerPage);

    // 标记话题为已读
    const markAsRead = async (topicId: string) => {
        try {
            // 更新本地状态
            setReadTopics(prev => ({
                ...prev,
                [topicId]: true
            }));

            // 使用新的API标记为已读
            await markTopicAsRead(topicId);

            Notification.success({
                title: "标记成功",
                description: "话题已标记为已读"
            });
        } catch (error) {
            console.error("Failed to mark topic as read:", error);
            // 如果API调用失败，回滚本地状态
            setReadTopics(prev => ({
                ...prev,
                [topicId]: false
            }));
            Notification.error({
                title: "标记失败",
                description: "无法标记话题为已读"
            });
        }
    };

    // 切换收藏状态
    const toggleFavorite = async (topicId: string) => {
        try {
            const isCurrentlyFavorite = favoriteTopics[topicId];

            // 更新本地状态（乐观更新）
            setFavoriteTopics(prev => ({
                ...prev,
                [topicId]: !isCurrentlyFavorite
            }));

            if (isCurrentlyFavorite) {
                // 取消收藏
                await removeTopicFromFavorites(topicId);
                Notification.success({
                    title: "取消收藏",
                    description: "话题已从收藏中移除"
                });
            } else {
                // 添加收藏
                await markTopicAsFavorite(topicId);
                Notification.success({
                    title: "收藏成功",
                    description: "话题已添加到收藏"
                });
            }
        } catch (error) {
            console.error("Failed to toggle favorite status:", error);
            // 如果API调用失败，回滚本地状态
            setFavoriteTopics(prev => ({
                ...prev,
                [topicId]: favoriteTopics[topicId]
            }));
            Notification.error({
                title: "操作失败",
                description: "无法更新收藏状态"
            });
        }
    };

    return (
        <DefaultLayout>
            <section className="flex flex-col gap-4 py-0 md:py-10">
                <div className="hidden sm:flex items-center justify-center">
                    <img alt="logo" className="w-21 mr-5" src="./logo.webp" />
                    <div className="flex flex-col items-center justify-center gap-4">
                        <h1 className={title()}>最新话题</h1>
                        <p className="text-default-600 max-w-2xl text-center">按时间排序的最新聊天话题摘要</p>
                    </div>
                </div>

                <Card className="mt-0 md:mt-6">
                    <CardHeader className="flex flex-row justify-between items-center pl-7 pr-7 gap-4">
                        <div className="flex flex-row items-center gap-4">
                            <h2 className="text-xl font-bold min-w-[135px]">话题列表 ({filteredTopics.length})</h2>
                            <Input
                                isClearable
                                aria-label="全文搜索"
                                className="max-w-[135px]"
                                placeholder="搜索..."
                                startContent={<Search size={16} />}
                                value={searchText}
                                onValueChange={setSearchText}
                            />
                        </div>

                        {/* 顶栏右侧 */}
                        <ResponsivePopover buttonText="筛选...">
                            <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-3 lg:p-0">
                                {/* 筛选控件 */}
                                <div className="flex gap-3 items-center">
                                    <div className="text-default-600 text-sm w-27">每页显示:</div>
                                    <Slider
                                        aria-label="每页显示话题数量"
                                        className="max-w-[120px]"
                                        color="primary"
                                        defaultValue={6}
                                        maxValue={12}
                                        minValue={3}
                                        showTooltip={true}
                                        size="md"
                                        step={3}
                                        value={topicsPerPage}
                                        onChange={value => {
                                            setTopicsPerPage(Number(value));
                                        }}
                                    />
                                    <span className="text-default-900 text-sm w-30">{topicsPerPage} 张卡片</span>
                                </div>

                                <Checkbox className="w-110" isSelected={filterRead} onValueChange={setFilterRead}>
                                    只看未读
                                </Checkbox>

                                <Checkbox className="w-110" isSelected={filterFavorite} onValueChange={setFilterFavorite}>
                                    只看收藏
                                </Checkbox>

                                <Checkbox className="w-150" isSelected={sortByInterest} onValueChange={setSortByInterest}>
                                    按兴趣度排序
                                </Checkbox>

                                {/* 日期选择器 + 刷新按钮 */}
                                <DateRangePicker
                                    className="max-w-xs"
                                    label="时间范围"
                                    value={dateRange}
                                    onChange={range => {
                                        if (range) {
                                            setDateRange({
                                                start: range.start,
                                                end: range.end
                                            });
                                        }
                                    }}
                                />
                                <Button
                                    color="primary"
                                    isLoading={loading}
                                    onPress={() => {
                                        const start = dateRange.start.toDate(getLocalTimeZone());
                                        const end = dateRange.end.toDate(getLocalTimeZone());

                                        fetchLatestTopics(start, end);
                                    }}
                                >
                                    刷新
                                </Button>
                            </div>
                        </ResponsivePopover>
                    </CardHeader>

                    <CardBody className="relative">
                        {loading ? (
                            <div className="flex justify-center items-center h-64">
                                <Spinner size="lg" />
                            </div>
                        ) : currentPageTopics.length > 0 ? (
                            <div className="flex flex-col gap-4">
                                <ScrollShadow className="max-h-[calc(100vh-220px)]">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-0 md:p-5">
                                        {currentPageTopics.map((topic, index) => {
                                            // 解析参与者
                                            const contributorsArray = parseContributors(topic.contributors);

                                            return (
                                                <Card key={`${topic.topicId}-${index}`} className="border border-default-200">
                                                    <CardHeader className="flex flex-col gap-2 relative">
                                                        {/* item顺序号 */}
                                                        <Chip className="absolute top-3.5 left-4" size="sm" variant="flat">
                                                            #{(page - 1) * topicsPerPage + index + 1}
                                                        </Chip>
                                                        {/* 兴趣指数 */}
                                                        {interestScores[topic.topicId] !== undefined && (
                                                            <Chip
                                                                className="absolute top-3.5 right-4"
                                                                color={interestScores[topic.topicId] > 0 ? "success" : interestScores[topic.topicId] < 0 ? "danger" : "default"}
                                                                size="sm"
                                                                style={{
                                                                    backgroundColor: generateColorFromInterestScore(interestScores[topic.topicId], false),
                                                                    color: "white"
                                                                }}
                                                                variant="flat"
                                                            >
                                                                {interestScores[topic.topicId].toFixed(2)}
                                                            </Chip>
                                                        )}
                                                        <div className="flex justify-between items-start">
                                                            {/* 正文部分 */}
                                                            <h3 className="text-lg font-bold max-w-60 word-break break-all">{topic.topic}</h3>
                                                            <Tooltip color="default" content="复制话题内容" placement="top">
                                                                <HeroUIButton
                                                                    isIconOnly
                                                                    size="sm"
                                                                    variant="light"
                                                                    onPress={() => {
                                                                        // 复制话题内容到剪贴板
                                                                        const contentToCopy = `话题: ${topic.topic}\n\n参与者: ${contributorsArray.join(", ")}\n\n详情: ${topic.detail}\n\n时间: ${new Date(topic.timeStart).toLocaleString()} - ${new Date(topic.timeEnd).toLocaleString()}\n群ID: ${topic.groupId}\n话题ID: ${topic.topicId}\n会话ID: ${topic.sessionId}`;

                                                                        navigator.clipboard
                                                                            .writeText(contentToCopy)
                                                                            .then(() => {
                                                                                Notification.success({
                                                                                    title: "复制成功",
                                                                                    description: "话题内容已复制到剪贴板"
                                                                                });
                                                                            })
                                                                            .catch(err => {
                                                                                console.error("复制失败:", err);
                                                                                Notification.error({
                                                                                    title: "复制失败",
                                                                                    description: "无法复制话题内容"
                                                                                });
                                                                            });
                                                                    }}
                                                                >
                                                                    <Copy size={16} />
                                                                </HeroUIButton>
                                                            </Tooltip>
                                                        </div>
                                                        <div className="text-default-500 text-sm">
                                                            <Chip className="mr-1" size="sm" variant="flat">
                                                                🕗
                                                                {new Date(topic.timeStart).toLocaleDateString("zh-CN", {
                                                                    month: "short",
                                                                    day: "numeric",
                                                                    hour: "2-digit",
                                                                    minute: "2-digit"
                                                                })}
                                                            </Chip>
                                                            ➡️
                                                            <Chip className="ml-1" size="sm" variant="flat">
                                                                🕗
                                                                {new Date(topic.timeEnd).toLocaleDateString("zh-CN", {
                                                                    month: "short",
                                                                    day: "numeric",
                                                                    hour: "2-digit",
                                                                    minute: "2-digit"
                                                                })}
                                                            </Chip>
                                                        </div>
                                                    </CardHeader>
                                                    <CardBody className="relative pb-9">
                                                        <EnhancedDetail contributors={contributorsArray} detail={topic.detail} />
                                                        {/* 在左下角添加群ID的Chip和群头像 */}
                                                        <div className="absolute bottom-3 left-3 flex items-center gap-2">
                                                            <img
                                                                alt="群头像"
                                                                className="w-6 h-6 rounded-full"
                                                                src={`http://p.qlogo.cn/gh/${topic.groupId}/${topic.groupId}/0`}
                                                                onError={e => {
                                                                    const target = e.target as HTMLImageElement;

                                                                    target.onerror = null;
                                                                    target.src =
                                                                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ccc'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
                                                                }}
                                                            />
                                                            <Chip size="sm" variant="flat">
                                                                群ID: {topic.groupId}
                                                            </Chip>
                                                        </div>
                                                        {/* 右下角的更多选项、收藏按钮和已读按钮 */}
                                                        <div className="absolute bottom-3 right-3 flex gap-1">
                                                            <Dropdown>
                                                                <DropdownTrigger>
                                                                    <HeroUIButton isIconOnly size="sm" variant="light">
                                                                        <MoreVertical size={16} />
                                                                    </HeroUIButton>
                                                                </DropdownTrigger>
                                                                <DropdownMenu aria-label="更多选项">
                                                                    <DropdownItem key="participants" textValue="参与者">
                                                                        <div className="flex flex-col gap-1">
                                                                            <p className="font-medium">参与者</p>
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {contributorsArray.map((contributor, idx) => (
                                                                                    <Chip
                                                                                        key={idx}
                                                                                        size="sm"
                                                                                        style={{
                                                                                            backgroundColor: generateColorFromName(contributor),
                                                                                            color: generateColorFromName(contributor, false),
                                                                                            fontWeight: "bold"
                                                                                        }}
                                                                                        variant="flat"
                                                                                    >
                                                                                        {contributor}
                                                                                    </Chip>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    </DropdownItem>
                                                                    <DropdownItem key="topicId" textValue="话题ID">
                                                                        <div className="flex flex-col gap-1">
                                                                            <p className="font-medium">话题ID</p>
                                                                            <p className="text-sm">{topic.topicId}</p>
                                                                        </div>
                                                                    </DropdownItem>
                                                                    <DropdownItem key="sessionId" textValue="会话ID">
                                                                        <div className="flex flex-col gap-1">
                                                                            <p className="font-medium">会话ID</p>
                                                                            <p className="text-sm">{topic.sessionId}</p>
                                                                        </div>
                                                                    </DropdownItem>
                                                                    <DropdownItem key="groupId" textValue="群ID">
                                                                        <div className="flex flex-col gap-1">
                                                                            <p className="font-medium">群ID</p>
                                                                            <p className="text-sm">{topic.groupId}</p>
                                                                        </div>
                                                                    </DropdownItem>
                                                                </DropdownMenu>
                                                            </Dropdown>
                                                            <Tooltip color="warning" content={favoriteTopics[topic.topicId] ? "取消收藏" : "添加收藏"} placement="top">
                                                                <HeroUIButton isIconOnly color="warning" size="sm" variant="flat" onPress={() => toggleFavorite(topic.topicId)}>
                                                                    <Star fill={favoriteTopics[topic.topicId] ? "currentColor" : "none"} size={16} />
                                                                </HeroUIButton>
                                                            </Tooltip>
                                                            {!readTopics[topic.topicId] && (
                                                                <Tooltip color="primary" content="标记为已读" placement="top">
                                                                    <HeroUIButton isIconOnly color="primary" size="sm" variant="flat" onPress={() => markAsRead(topic.topicId)}>
                                                                        <Check size={16} />
                                                                    </HeroUIButton>
                                                                </Tooltip>
                                                            )}
                                                        </div>
                                                    </CardBody>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </ScrollShadow>

                                {totalPages > 1 && (
                                    <div className="flex justify-center mt-4">
                                        <Pagination showControls color="primary" page={page} size="md" total={totalPages} onChange={setPage} />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <p className="text-default-500">暂无话题数据，请调整筛选条件后重试</p>
                                <Button
                                    className="mt-4"
                                    color="primary"
                                    variant="light"
                                    onPress={() => {
                                        const start = dateRange.start.toDate(getLocalTimeZone());
                                        const end = dateRange.end.toDate(getLocalTimeZone());

                                        fetchLatestTopics(start, end);
                                    }}
                                >
                                    重新加载
                                </Button>
                            </div>
                        )}

                        {/* 整页已读按钮 - 固定在右下角 */}
                        {!loading && currentPageTopics.length > 0 && currentPageTopics.some(topic => !readTopics[topic.topicId]) && (
                            <div className="absolute bottom-4 right-4 hidden md:block">
                                <Tooltip color="primary" content="将当前页面所有未读话题标记为已读" placement="top">
                                    <Button
                                        color="primary"
                                        size="sm"
                                        startContent={<Check size={16} />}
                                        variant="flat"
                                        onPress={async () => {
                                            const unreadTopics = currentPageTopics.filter(topic => !readTopics[topic.topicId]);

                                            try {
                                                // 批量标记为已读
                                                const promises = unreadTopics.map(topic => markTopicAsRead(topic.topicId));

                                                await Promise.all(promises);

                                                // 更新本地状态
                                                const newReadTopics = { ...readTopics };

                                                unreadTopics.forEach(topic => {
                                                    newReadTopics[topic.topicId] = true;
                                                });
                                                setReadTopics(newReadTopics);

                                                Notification.success({
                                                    title: "批量标记成功",
                                                    description: `已将 ${unreadTopics.length} 个话题标记为已读`
                                                });
                                            } catch (error) {
                                                console.error("Failed to mark all topics as read:", error);
                                                Notification.error({
                                                    title: "批量标记失败",
                                                    description: "无法标记所有话题为已读"
                                                });
                                            }
                                        }}
                                    >
                                        整页已读
                                    </Button>
                                </Tooltip>
                            </div>
                        )}
                    </CardBody>
                </Card>
            </section>
        </DefaultLayout>
    );
}
