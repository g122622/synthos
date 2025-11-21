import { useState, useEffect } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/table";
import { Pagination } from "@heroui/pagination";
import { Select, SelectItem } from "@heroui/select";
import { DateRangePicker } from "@heroui/react";
import { Spinner } from "@heroui/spinner";
import { useAsyncList } from "@react-stately/data";
import { today, getLocalTimeZone } from "@internationalized/date";

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
    const [dateRange, setDateRange] = useState({
        start: today(getLocalTimeZone()).subtract({ days: 7 }),
        end: today(getLocalTimeZone())
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

            // 获取DateRangePicker的值
            const startDate = dateRange.start.toDate(getLocalTimeZone()).getTime();
            const endDate = dateRange.end.toDate(getLocalTimeZone()).getTime();

            setIsLoading(true);
            try {
                const response = await getChatMessagesByGroupId(selectedGroup, startDate, endDate);

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

    // 当群组改变时重新加载数据
    useEffect(() => {
        if (selectedGroup) {
            list.reload();
        }
    }, [selectedGroup, dateRange]);

    // 格式化时间戳
    const formatTimestamp = (timestamp: number) => {
        return new Date(timestamp).toLocaleString("zh-CN");
    };

    return (
        <DefaultLayout>
            <section className="flex flex-col gap-4 py-8 md:py-10">
                <div className="flex flex-col items-center justify-center gap-4">
                    <h1 className={title()}>聊天记录管理</h1>
                    <p className="text-default-600 max-w-2xl text-center">查看和筛选QQ群聊天记录，支持按时间范围和群组进行过滤</p>
                </div>

                <Card className="mt-6">
                    <CardHeader>
                        <div className="flex flex-col md:flex-row gap-4 items-center justify-start w-full pl-3 pr-3">
                            <div className="flex-1 w-full">
                                <Select
                                    className="max-w-xs"
                                    label="选择群组"
                                    placeholder="请选择群组"
                                    selectedKeys={[selectedGroup]}
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
                            </div>

                            <div className="flex-1 w-full">
                                <DateRangePicker
                                    className="max-w-xs"
                                    value={dateRange}
                                    label="筛选时间范围"
                                    onChange={range => {
                                        if (range) {
                                            setDateRange({
                                                start: range.start,
                                                end: range.end
                                            });
                                        }
                                    }}
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button color="primary" isLoading={isLoading} onPress={() => list.reload()}>
                                    {isLoading ? <Spinner size="sm" /> : "查询"}
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardBody>
                        {isLoading ? (
                            <div className="flex justify-center items-center h-64">
                                <Spinner size="lg" />
                            </div>
                        ) : (
                            <>
                                <Table
                                    aria-label="聊天记录表"
                                    bottomContent={
                                        <div className="flex w-full justify-center">
                                            <Pagination
                                                isCompact
                                                showControls
                                                showShadow
                                                color="primary"
                                                page={currentPage}
                                                total={Math.ceil(list.items.length / pageSize)}
                                                onChange={page => setCurrentPage(page)}
                                            />
                                        </div>
                                    }
                                >
                                    <TableHeader>
                                        <TableColumn>发送者</TableColumn>
                                        <TableColumn>消息内容</TableColumn>
                                        <TableColumn>时间</TableColumn>
                                        <TableColumn>会话ID</TableColumn>
                                    </TableHeader>
                                    <TableBody emptyContent={"未找到相关聊天记录"}>
                                        {list.items.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(message => (
                                            <TableRow key={message.msgId}>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold">{message.senderGroupNickname || message.senderNickname}</span>
                                                        <span className="text-sm text-default-500">{message.senderId}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="max-w-md truncate" title={message.messageContent}>
                                                        {message.messageContent}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{formatTimestamp(message.timestamp)}</TableCell>
                                                <TableCell>{message.sessionId}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </>
                        )}
                    </CardBody>
                </Card>
            </section>
        </DefaultLayout>
    );
}
