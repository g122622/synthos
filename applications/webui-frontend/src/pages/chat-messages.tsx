import { useState, useEffect, useMemo } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, SortDescriptor } from "@heroui/table";
import { Pagination } from "@heroui/pagination";
import { Select, SelectItem } from "@heroui/select";
import { DatePicker, Chip, Input } from "@heroui/react";
import { Spinner } from "@heroui/spinner";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { useAsyncList } from "@react-stately/data";
import { now, getLocalTimeZone } from "@internationalized/date";
import { MessageSquare, RefreshCw, Search } from "lucide-react";

import { getChatMessagesByGroupId, getGroupDetails } from "@/api/basicApi";
import { ChatMessage, GroupDetailsRecord } from "@/types/app";
import { title } from "@/components/primitives";
import DefaultLayout from "@/layouts/default";

export default function ChatMessagesPage() {
    const [groups, setGroups] = useState<GroupDetailsRecord>({});
    const [selectedGroup, setSelectedGroup] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const pageSize = 10;
    // 时间范围选择：使用两个DatePicker
    const [startDate, setStartDate] = useState(now(getLocalTimeZone()).subtract({ days: 7 }));
    const [endDate, setEndDate] = useState(now(getLocalTimeZone()));
    // 搜索关键词
    const [searchKeyword, setSearchKeyword] = useState<string>("");
    // 排序描述符
    const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
        column: "timestamp",
        direction: "descending"
    });

    // 获取群组信息
    useEffect(() => {
        const fetchGroups = async () => {
            try {
                const response = await getGroupDetails();

                if (response.success) {
                    setGroups(response.data);
                    // 默认选择第一个群组
                    const groupIds = Object.keys(response.data);

                    if (groupIds.length > 0) {
                        setSelectedGroup(groupIds[0]);
                    }
                }
            } catch (error) {
                console.error("获取群组信息失败:", error);
            }
        };

        fetchGroups();
    }, []);

    // 获取聊天记录
    const list = useAsyncList<ChatMessage>({
        async load({}) {
            if (!selectedGroup) {
                return {
                    items: []
                };
            }

            // 获取DatePicker的值
            const startTime = startDate.toDate(getLocalTimeZone()).getTime();
            const endTime = endDate.toDate(getLocalTimeZone()).getTime();

            setIsLoading(true);
            try {
                const response = await getChatMessagesByGroupId(selectedGroup, startTime, endTime);

                setIsLoading(false);

                if (response.success) {
                    return {
                        items: response.data
                    };
                } else {
                    console.error("获取聊天记录失败:", response.message);

                    return {
                        items: []
                    };
                }
            } catch (error) {
                setIsLoading(false);
                console.error("获取聊天记录失败:", error);

                return {
                    items: []
                };
            }
        }
    });

    // 当群组或时间范围改变时重新加载数据
    useEffect(() => {
        if (selectedGroup) {
            list.reload();
        }
    }, [selectedGroup, startDate, endDate]);

    // 根据搜索关键词过滤并排序消息
    const filteredAndSortedItems = useMemo(() => {
        let items = list.items;

        // 先进行搜索过滤
        if (searchKeyword.trim()) {
            const keyword = searchKeyword.toLowerCase();

            items = items.filter(message => {
                const nickname = (message.senderGroupNickname || message.senderNickname || "").toLowerCase();
                const content = (message.messageContent || "").toLowerCase();
                const senderId = (message.senderId || "").toLowerCase();

                return nickname.includes(keyword) || content.includes(keyword) || senderId.includes(keyword);
            });
        }

        // 再进行排序
        if (sortDescriptor.column) {
            items = [...items].sort((a, b) => {
                let first: string | number;
                let second: string | number;

                switch (sortDescriptor.column) {
                    case "sender":
                        first = a.senderGroupNickname || a.senderNickname || "";
                        second = b.senderGroupNickname || b.senderNickname || "";
                        break;
                    case "content":
                        first = a.messageContent || "";
                        second = b.messageContent || "";
                        break;
                    case "timestamp":
                        first = a.timestamp;
                        second = b.timestamp;
                        break;
                    case "sessionId":
                        first = a.sessionId || "";
                        second = b.sessionId || "";
                        break;
                    default:
                        return 0;
                }

                // 比较逻辑：支持数字和字符串
                let cmp: number;

                if (typeof first === "number" && typeof second === "number") {
                    cmp = first < second ? -1 : first > second ? 1 : 0;
                } else {
                    cmp = String(first).localeCompare(String(second));
                }

                if (sortDescriptor.direction === "descending") {
                    cmp *= -1;
                }

                return cmp;
            });
        }

        return items;
    }, [list.items, searchKeyword, sortDescriptor]);

    // 搜索关键词变化时重置页码
    useEffect(() => {
        setCurrentPage(1);
    }, [searchKeyword]);

    // 处理排序变更
    const handleSortChange = (descriptor: SortDescriptor) => {
        setSortDescriptor(descriptor);
    };

    // 格式化时间戳
    const formatTimestamp = (timestamp: number) => {
        return new Date(timestamp).toLocaleString("zh-CN");
    };

    // 计算总页数
    const totalPages = Math.ceil(filteredAndSortedItems.length / pageSize);

    return (
        <DefaultLayout>
            <section className="flex flex-col gap-4 py-0 md:py-10">
                {/* 页面标题 */}
                <div className="hidden sm:flex items-center justify-center">
                    <img alt="logo" className="w-21 mr-5" src="./logo.webp" />
                    <div className="flex flex-col items-center justify-center gap-4">
                        <h1 className={title()}>聊天记录管理</h1>
                        <p className="text-default-600 max-w-2xl text-center">查看和筛选QQ群聊天记录，支持按时间范围和群组进行过滤</p>
                    </div>
                </div>

                {/* 主内容区 */}
                <Card className="mt-0 md:mt-6">
                    <CardHeader className="flex flex-col gap-4 pl-4 pr-4 md:pl-7 md:pr-7">
                        {/* 标题行 */}
                        <div className="flex flex-row justify-between items-center w-full flex-wrap gap-2">
                            <div className="flex flex-row items-center gap-4">
                                <h2 className="text-xl font-bold">
                                    <MessageSquare className="inline-block mr-2" size={20} />
                                    聊天记录
                                </h2>
                                <Chip color="primary" size="sm" variant="flat">
                                    共 {filteredAndSortedItems.length} 条{searchKeyword && ` (筛选自 ${list.items.length} 条)`}
                                </Chip>
                            </div>

                            {/* 刷新按钮 */}
                            <Button color="primary" isLoading={isLoading} size="sm" startContent={<RefreshCw size={16} />} variant="flat" onPress={() => list.reload()}>
                                刷新
                            </Button>
                        </div>

                        {/* 筛选区域 */}
                        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center w-full flex-wrap">
                            {/* 群组选择 */}
                            <Select
                                className="w-full md:w-56"
                                label="选择群组"
                                placeholder="请选择群组"
                                selectedKeys={[selectedGroup]}
                                size="sm"
                                onSelectionChange={keys => {
                                    if (keys !== "all") {
                                        const selectedKey = Array.from(keys)[0] as string;

                                        setSelectedGroup(selectedKey);
                                    }
                                }}
                            >
                                {Object.keys(groups).map(groupId => (
                                    <SelectItem key={groupId}>
                                        {groupId} - {groups[groupId].groupIntroduction}
                                    </SelectItem>
                                ))}
                            </Select>

                            {/* 开始时间选择 */}
                            <DatePicker
                                hideTimeZone
                                showMonthAndYearPickers
                                className="w-full md:w-56"
                                granularity="minute"
                                label="开始时间"
                                size="sm"
                                value={startDate}
                                onChange={date => {
                                    if (date) {
                                        setStartDate(date);
                                    }
                                }}
                            />

                            {/* 结束时间选择 */}
                            <DatePicker
                                hideTimeZone
                                showMonthAndYearPickers
                                className="w-full md:w-56"
                                granularity="minute"
                                label="结束时间"
                                size="sm"
                                value={endDate}
                                onChange={date => {
                                    if (date) {
                                        setEndDate(date);
                                    }
                                }}
                            />

                            {/* 搜索输入框 */}
                            <Input
                                isClearable
                                className="w-full md:w-64"
                                placeholder="搜索发送者或消息内容..."
                                size="sm"
                                startContent={<Search className="text-default-400" size={16} />}
                                value={searchKeyword}
                                onClear={() => setSearchKeyword("")}
                                onValueChange={setSearchKeyword}
                            />
                        </div>
                    </CardHeader>
                    <CardBody>
                        {isLoading ? (
                            <div className="flex justify-center items-center h-64">
                                <Spinner size="lg" />
                            </div>
                        ) : filteredAndSortedItems.length > 0 ? (
                            <div className="flex flex-col gap-4">
                                <ScrollShadow className="max-h-[calc(100vh-420px)]">
                                    <Table removeWrapper aria-label="聊天记录表" sortDescriptor={sortDescriptor} onSortChange={handleSortChange}>
                                        <TableHeader>
                                            <TableColumn key="sender" allowsSorting>
                                                发送者
                                            </TableColumn>
                                            <TableColumn key="content" allowsSorting>
                                                消息内容
                                            </TableColumn>
                                            <TableColumn key="timestamp" allowsSorting className="hidden md:table-cell">
                                                时间
                                            </TableColumn>
                                            <TableColumn key="sessionId" allowsSorting className="hidden lg:table-cell">
                                                会话ID
                                            </TableColumn>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredAndSortedItems.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(message => (
                                                <TableRow key={message.msgId}>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold text-sm">{message.senderGroupNickname || message.senderNickname}</span>
                                                            <span className="text-xs text-default-500">{message.senderId}</span>
                                                            {/* 移动端显示时间 */}
                                                            <span className="text-xs text-default-400 md:hidden">{formatTimestamp(message.timestamp)}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="max-w-xs md:max-w-md truncate" title={message.messageContent}>
                                                            {message.messageContent}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="hidden md:table-cell">{formatTimestamp(message.timestamp)}</TableCell>
                                                    <TableCell className="hidden lg:table-cell">{message.sessionId}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </ScrollShadow>

                                {totalPages > 1 && (
                                    <div className="flex w-full justify-center">
                                        <Pagination isCompact showControls showShadow color="primary" page={currentPage} total={totalPages} onChange={page => setCurrentPage(page)} />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <MessageSquare className="mx-auto mb-4 text-default-400" size={48} />
                                <p className="text-default-500">{searchKeyword ? "未找到匹配的聊天记录" : "未找到相关聊天记录"}</p>
                                <p className="text-default-400 text-sm mt-2">{searchKeyword ? "尝试更换搜索关键词" : "请选择群组和时间范围后点击查询"}</p>
                            </div>
                        )}
                    </CardBody>
                </Card>
            </section>
        </DefaultLayout>
    );
}
