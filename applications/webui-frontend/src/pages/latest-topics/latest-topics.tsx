import type { TopicItem } from "@/types/topic";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Pagination } from "@heroui/pagination";
import { Spinner } from "@heroui/spinner";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { DateRangePicker, Tooltip, Input, Checkbox, Select, SelectItem } from "@heroui/react";
import { Check, Search } from "lucide-react";
import { today, getLocalTimeZone, CalendarDate } from "@internationalized/date";

import TopicCard from "@/components/topic/TopicCard";
import { parseContributors } from "@/components/topic/utils";
import QQAvatar from "@/components/QQAvatar";
import { getGroupDetails, getSessionIdsByGroupIdsAndTimeRange, getSessionTimeDurations, getAIDigestResultsBySessionIds } from "@/api/basicApi";
import { getInterestScoreResults } from "@/api/interestScoreApi";
import { markTopicAsRead, getTopicsReadStatus, markTopicAsFavorite, removeTopicFromFavorites, getTopicsFavoriteStatus } from "@/api/readAndFavApi";
import { title } from "@/components/primitives";
import DefaultLayout from "@/layouts/default";
import { Notification } from "@/util/Notification";
import ResponsivePopover from "@/components/ResponsivePopover";
import throttle from "@/util/throttle";
import { GroupDetailsRecord } from "@/types/app";

export default function LatestTopicsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [topics, setTopics] = useState<TopicItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [page, setPage] = useState<number>(1);
    const [topicsPerPage, setTopicsPerPage] = useState<number>(6); // 将topicsPerPage改为状态
    const [readTopics, setReadTopics] = useState<Record<string, boolean>>({});
    const [favoriteTopics, setFavoriteTopics] = useState<Record<string, boolean>>({}); // 收藏状态
    const [interestScores, setInterestScores] = useState<Record<string, number>>({}); // 兴趣得分状态

    // 群组筛选状态
    const [groups, setGroups] = useState<GroupDetailsRecord>({});
    const [selectedGroupId, setSelectedGroupId] = useState<string>(""); // 空字符串表示"全部群组"

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

    // 标记是否已从URL初始化
    const [isInitializedFromUrl, setIsInitializedFromUrl] = useState<boolean>(false);

    // 从URL参数初始化状态
    useEffect(() => {
        const fetchGroupsAndInitFromUrl = async () => {
            try {
                const response = await getGroupDetails();

                if (response.success) {
                    setGroups(response.data);
                    const groupIds = Object.keys(response.data);

                    // 从URL获取参数
                    const urlGroupId = searchParams.get("groupId");
                    const urlFilterRead = searchParams.get("filterRead");
                    const urlFilterFavorite = searchParams.get("filterFavorite");
                    const urlSortByInterest = searchParams.get("sortByInterest");
                    const urlSearchText = searchParams.get("search");
                    const urlPage = searchParams.get("page");
                    const urlStartDate = searchParams.get("startDate");
                    const urlEndDate = searchParams.get("endDate");

                    // 处理群组ID
                    if (urlGroupId) {
                        if (groupIds.includes(urlGroupId)) {
                            setSelectedGroupId(urlGroupId);
                        } else {
                            // URL中的groupId不存在于群组列表中，提示用户
                            Notification.error({
                                title: "群组不存在",
                                description: `URL中指定的群组ID "${urlGroupId}" 不存在`
                            });
                        }
                    }

                    // 处理筛选开关
                    if (urlFilterRead !== null) {
                        setFilterRead(urlFilterRead === "true");
                    }
                    if (urlFilterFavorite !== null) {
                        setFilterFavorite(urlFilterFavorite === "true");
                    }
                    if (urlSortByInterest !== null) {
                        setSortByInterest(urlSortByInterest === "true");
                    }

                    // 处理搜索文本
                    if (urlSearchText) {
                        setSearchText(urlSearchText);
                    }

                    // 处理页码
                    if (urlPage) {
                        const pageNum = parseInt(urlPage, 10);

                        if (!isNaN(pageNum) && pageNum >= 1) {
                            setPage(pageNum);
                        }
                    }

                    // 处理时间范围
                    if (urlStartDate && urlEndDate) {
                        try {
                            const startParts = urlStartDate.split("-").map(Number);
                            const endParts = urlEndDate.split("-").map(Number);

                            if (startParts.length === 3 && endParts.length === 3) {
                                setDateRange({
                                    start: new CalendarDate(startParts[0], startParts[1], startParts[2]),
                                    end: new CalendarDate(endParts[0], endParts[1], endParts[2])
                                });
                            }
                        } catch {
                            // 日期解析失败，使用默认值
                        }
                    }
                }
            } catch (error) {
                console.error("获取群组信息失败:", error);
            } finally {
                setIsInitializedFromUrl(true);
            }
        };

        fetchGroupsAndInitFromUrl();
    }, []);

    // 同步筛选参数到URL
    useEffect(() => {
        // 只有在初始化完成后才同步URL
        if (!isInitializedFromUrl) {
            return;
        }

        const newParams = new URLSearchParams();

        if (selectedGroupId) {
            newParams.set("groupId", selectedGroupId);
        }
        if (!filterRead) {
            // 默认是true，所以只有为false时才写入URL
            newParams.set("filterRead", "false");
        }
        if (filterFavorite) {
            // 默认是false，所以只有为true时才写入URL
            newParams.set("filterFavorite", "true");
        }
        if (sortByInterest) {
            // 默认是false，所以只有为true时才写入URL
            newParams.set("sortByInterest", "true");
        }
        if (searchText) {
            newParams.set("search", searchText);
        }
        if (page > 1) {
            // 只有非第一页才写入URL
            newParams.set("page", String(page));
        }

        // 时间范围：格式化为 YYYY-MM-DD
        const defaultStart = today(getLocalTimeZone()).subtract({ days: 1 });
        const defaultEnd = today(getLocalTimeZone()).add({ days: 1 });

        // 只有当时间范围不是默认值时才写入URL
        const isStartDefault = dateRange.start.year === defaultStart.year && dateRange.start.month === defaultStart.month && dateRange.start.day === defaultStart.day;
        const isEndDefault = dateRange.end.year === defaultEnd.year && dateRange.end.month === defaultEnd.month && dateRange.end.day === defaultEnd.day;

        if (!isStartDefault || !isEndDefault) {
            newParams.set("startDate", `${dateRange.start.year}-${String(dateRange.start.month).padStart(2, "0")}-${String(dateRange.start.day).padStart(2, "0")}`);
            newParams.set("endDate", `${dateRange.end.year}-${String(dateRange.end.month).padStart(2, "0")}-${String(dateRange.end.day).padStart(2, "0")}`);
        }

        setSearchParams(newParams, { replace: true });
    }, [selectedGroupId, filterRead, filterFavorite, sortByInterest, searchText, page, dateRange, isInitializedFromUrl, setSearchParams]);

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

    // 初始加载 + 日期变化时重新加载（需等待URL初始化完成）
    useEffect(() => {
        if (!isInitializedFromUrl) {
            return;
        }
        const start = dateRange.start.toDate(getLocalTimeZone());
        const end = dateRange.end.toDate(getLocalTimeZone());

        fetchLatestTopics(start, end);
    }, [dateRange, isInitializedFromUrl]);

    // 当筛选条件改变时，重置页码
    useEffect(() => {
        setPage(1);
    }, [filterRead, filterFavorite, searchText, selectedGroupId]);

    // 应用筛选器
    const filteredTopics = topics.filter(topic => {
        // 群组筛选
        if (selectedGroupId && topic.groupId !== selectedGroupId) {
            return false;
        }

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
                                {/* 群组选择器 */}
                                <Select
                                    className="w-full lg:w-60"
                                    isClearable={true}
                                    label="群组"
                                    placeholder="全部群组"
                                    selectedKeys={selectedGroupId ? [selectedGroupId] : []}
                                    size="sm"
                                    onSelectionChange={keys => {
                                        if (keys === "all" || (keys instanceof Set && keys.size === 0)) {
                                            setSelectedGroupId("");
                                        } else {
                                            const selectedKey = Array.from(keys)[0] as string;

                                            setSelectedGroupId(selectedKey || "");
                                        }
                                    }}
                                >
                                    {Object.keys(groups).map(groupId => (
                                        <SelectItem key={groupId} startContent={<QQAvatar qqId={groupId} type="group" />}>
                                            {groupId}
                                        </SelectItem>
                                    ))}
                                </Select>

                                {/* 筛选控件 */}
                                <div className="flex gap-3 items-center">
                                    <Select
                                        className="w-27"
                                        label="每页话题数"
                                        selectedKeys={[String(topicsPerPage)]}
                                        size="sm"
                                        onSelectionChange={keys => {
                                            const selected = Array.from(keys)[0];

                                            if (selected) {
                                                setTopicsPerPage(Number(selected));
                                            }
                                        }}
                                    >
                                        <SelectItem key="3">3</SelectItem>
                                        <SelectItem key="6">6</SelectItem>
                                        <SelectItem key="9">9</SelectItem>
                                        <SelectItem key="12">12</SelectItem>
                                    </Select>
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
                                    className="w-full lg:w-70"
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
                                        {currentPageTopics.map((topic, index) => (
                                            <TopicCard
                                                key={`${topic.topicId}-${index}`}
                                                favoriteTopics={favoriteTopics}
                                                index={(page - 1) * topicsPerPage + index + 1}
                                                interestScore={interestScores[topic.topicId]}
                                                readTopics={readTopics}
                                                topic={topic}
                                                onMarkAsRead={markAsRead}
                                                onToggleFavorite={toggleFavorite}
                                            />
                                        ))}
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
