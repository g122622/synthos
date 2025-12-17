import React, { useState, useEffect, useRef } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/table";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import * as echarts from "echarts";

import { getGroupDetails, getChatMessagesByGroupId } from "@/api/basicApi";
import { GroupDetailsRecord } from "@/types/app";
import { title } from "@/components/primitives";
import DefaultLayout from "@/layouts/default";

export default function GroupsPage() {
    const [groups, setGroups] = useState<GroupDetailsRecord>({});
    const [recentMessageCounts, setRecentMessageCounts] = useState<Record<string, number>>({});
    const [totalRecentMessageCount, setTotalRecentMessageCount] = useState<number>(0);
    const [setTotalHourlyCounts] = useState<number[]>(new Array(24).fill(0));
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const totalChartRef = useRef<HTMLDivElement | null>(null);
    const totalChartInstance = useRef<echarts.EChartsType | null>(null);
    const chartRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const chartInstances = useRef<Record<string, echarts.EChartsType | null>>({});

    // 渲染消息量走势图表
    const renderMessageTrendChart = (groupId: string, hourlyData: number[]) => {
        const chartRef = chartRefs.current[groupId];

        if (chartRef) {
            // 如果图表实例已存在，先销毁
            if (chartInstances.current[groupId]) {
                chartInstances.current[groupId]?.dispose();
            }

            // 初始化图表实例
            const chartInstance = echarts.init(chartRef);

            chartInstances.current[groupId] = chartInstance;

            // 生成X轴标签
            const xLabels = generateHourlyTimestamps().slice(0, 24).map(formatHour);

            // 图表配置
            const option = {
                tooltip: {
                    trigger: "axis"
                },
                xAxis: {
                    type: "category",
                    data: xLabels,
                    axisLabel: {
                        rotate: 45,
                        fontSize: 10
                    }
                },
                yAxis: {
                    type: "value"
                },
                series: [
                    {
                        data: hourlyData,
                        type: "line",
                        smooth: true,
                        areaStyle: {}
                    }
                ],
                grid: {
                    left: "10%",
                    right: "10%",
                    top: "10%",
                    bottom: "20%"
                }
            };

            // 设置图表配置
            chartInstance.setOption(option);
        }
    };

    // 渲染总计消息量走势图表
    const renderTotalMessageTrendChart = (hourlyData: number[]) => {
        const chartRef = totalChartRef.current;

        if (chartRef) {
            // 如果图表实例已存在，先销毁
            if (totalChartInstance.current) {
                totalChartInstance.current?.dispose();
            }

            // 初始化图表实例
            const chartInstance = echarts.init(chartRef);

            totalChartInstance.current = chartInstance;

            // 生成X轴标签
            const xLabels = generateHourlyTimestamps().slice(0, 24).map(formatHour);

            // 图表配置
            const option = {
                tooltip: {
                    trigger: "axis"
                },
                xAxis: {
                    type: "category",
                    data: xLabels,
                    axisLabel: {
                        rotate: 45,
                        fontSize: 10
                    }
                },
                yAxis: {
                    type: "value"
                },
                series: [
                    {
                        data: hourlyData,
                        type: "line",
                        smooth: true,
                        areaStyle: {}
                    }
                ],
                grid: {
                    left: "10%",
                    right: "10%",
                    top: "10%",
                    bottom: "20%"
                }
            };

            // 设置图表配置
            chartInstance.setOption(option);
        }
    };

    // 获取最近24小时的时间戳
    const getRecent24HoursTimestamps = () => {
        const now = new Date().getTime();
        const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

        return { startTime: twentyFourHoursAgo, endTime: now };
    };

    // 生成最近24小时的小时时间点
    const generateHourlyTimestamps = () => {
        const now = new Date().getTime();
        const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
        const timestamps = [];

        for (let i = 0; i <= 24; i++) {
            timestamps.push(twentyFourHoursAgo + i * 60 * 60 * 1000);
        }

        return timestamps;
    };

    // 获取小时格式化时间
    const formatHour = (timestamp: number) => {
        const date = new Date(timestamp);

        return `${date.getHours()}:00`;
    };

    // 获取群组信息
    useEffect(() => {
        const fetchGroups = async () => {
            setIsLoading(true);
            try {
                const response = await getGroupDetails();

                if (response.success) {
                    setGroups(response.data);
                    // 获取每个群组的最近24小时消息量
                    await fetchRecentMessageCounts(response.data);
                } else {
                    console.error("获取群组信息失败:", response.message);
                }
            } catch (error) {
                console.error("获取群组信息失败:", error);
            } finally {
                setIsLoading(false);
            }
        };

        const fetchRecentMessageCounts = async (groupsData: GroupDetailsRecord) => {
            const { startTime, endTime } = getRecent24HoursTimestamps();
            const counts: Record<string, number> = {};
            const hourlyCounts: Record<string, number[]> = {};

            // 并行获取所有群组的最近24小时消息量
            const promises = Object.keys(groupsData).map(async groupId => {
                try {
                    const response = await getChatMessagesByGroupId(groupId, startTime, endTime);

                    if (response.success) {
                        counts[groupId] = response.data.length;

                        // 计算每小时消息量
                        const hourlyData = new Array(24).fill(0);
                        const hourlyTimestamps = generateHourlyTimestamps();

                        response.data.forEach(msg => {
                            const msgTime = msg.timestamp;

                            for (let i = 0; i < 24; i++) {
                                if (msgTime >= hourlyTimestamps[i] && msgTime < hourlyTimestamps[i + 1]) {
                                    hourlyData[i]++;
                                    break;
                                }
                            }
                        });

                        hourlyCounts[groupId] = hourlyData;
                    } else {
                        counts[groupId] = 0;
                        hourlyCounts[groupId] = new Array(24).fill(0);
                    }
                } catch (error) {
                    console.error(`获取群组 ${groupId} 的最近24小时消息量失败:`, error);
                    counts[groupId] = 0;
                    hourlyCounts[groupId] = new Array(24).fill(0);
                }
            });

            await Promise.all(promises);
            setRecentMessageCounts(counts);

            // 计算总计数据
            const totalCount = Object.values(counts).reduce((sum, count) => sum + count, 0);

            setTotalRecentMessageCount(totalCount);

            // 计算总小时数据
            const totalHourlyData = new Array(24).fill(0);

            Object.values(hourlyCounts).forEach(groupHourlyData => {
                groupHourlyData.forEach((count, index) => {
                    totalHourlyData[index] += count;
                });
            });
            setTotalHourlyCounts(totalHourlyData);

            // 保存每小时消息量用于图表渲染
            (window as any).hourlyCounts = hourlyCounts;

            // 在数据加载完成后渲染图表
            setTimeout(() => {
                // 渲染总计图表
                renderTotalMessageTrendChart(totalHourlyData);

                // 渲染各群组图表
                Object.keys(hourlyCounts).forEach(groupId => {
                    const chartRef = chartRefs.current[groupId];

                    if (chartRef) {
                        renderMessageTrendChart(groupId, hourlyCounts[groupId]);
                    }
                });
            }, 100);
        };

        fetchGroups();
    }, []);

    // 获取分组策略标签
    const getSplitStrategyLabel = (strategy: string) => {
        switch (strategy) {
            case "realtime":
                return "实时分组";
            case "accumulative":
                return "累积分组";
            default:
                return strategy;
        }
    };

    // 获取分组策略颜色
    const getSplitStrategyColor = (strategy: string) => {
        switch (strategy) {
            case "realtime":
                return "success";
            case "accumulative":
                return "warning";
            default:
                return "default";
        }
    };

    // 获取AI模型标签
    const getAIModelLabel = (model: string) => {
        switch (model) {
            case "gpt-3.5-turbo":
                return "GPT-3.5 Turbo";
            case "gpt-4":
                return "GPT-4";
            default:
                return model;
        }
    };

    return (
        <DefaultLayout>
            <section className="flex flex-col gap-4 py-8 md:py-10">
                <div className="flex flex-col items-center justify-center gap-4">
                    <h1 className={title()}>群组管理</h1>
                    <p className="text-default-600 max-w-2xl text-center">管理QQ群组配置信息，查看群组AI模型设置和分组策略</p>
                </div>

                <Card className="mt-6">
                    <CardHeader>
                        <div className="flex justify-between items-center w-full p-3">
                            <h3 className="text-lg font-bold">群组列表 ({Object.entries(groups).length})</h3>
                            <Button color="primary" isLoading={isLoading} size="sm" onPress={() => window.location.reload()}>
                                {isLoading ? <Spinner size="sm" /> : "刷新"}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardBody>
                        {isLoading ? (
                            <div className="flex justify-center items-center h-64">
                                <Spinner size="lg" />
                            </div>
                        ) : (
                            <Table aria-label="群组列表">
                                <TableHeader>
                                    <TableColumn>群头像</TableColumn>
                                    <TableColumn>群号</TableColumn>
                                    <TableColumn>平台</TableColumn>
                                    <TableColumn>群介绍</TableColumn>
                                    <TableColumn>分组策略</TableColumn>
                                    <TableColumn>AI模型</TableColumn>
                                    <TableColumn>最近24小时消息量</TableColumn>
                                    <TableColumn>最近24小时消息量走势</TableColumn>
                                </TableHeader>
                                <TableBody emptyContent={"未找到群组信息"}>
                                    {/* 总计行 */}
                                    <TableRow key="total">
                                        <TableCell>
                                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                                <span className="font-bold">总计</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-semibold">所有群组</TableCell>
                                        <TableCell>-</TableCell>
                                        <TableCell>-</TableCell>
                                        <TableCell>-</TableCell>
                                        <TableCell>-</TableCell>
                                        <TableCell>
                                            <span className="font-semibold">{totalRecentMessageCount}</span>
                                        </TableCell>
                                        <TableCell>
                                            <div ref={totalChartRef} style={{ width: "300px", height: "100px" }} />
                                        </TableCell>
                                    </TableRow>
                                    {Object.entries(groups).map(([groupId, groupDetail]) => (
                                        <TableRow key={groupId}>
                                            <TableCell>
                                                <img
                                                    alt="群头像"
                                                    className="w-10 h-10 rounded-full"
                                                    src={`http://p.qlogo.cn/gh/${groupId}/${groupId}/0`}
                                                    onError={e => {
                                                        const target = e.target as HTMLImageElement;

                                                        target.onerror = null;
                                                        target.src =
                                                            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ccc'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell className="font-semibold">{groupId}</TableCell>
                                            <TableCell>
                                                <Chip color={groupDetail.IM === "QQ" ? "primary" : "secondary"} variant="flat">
                                                    {groupDetail.IM}
                                                </Chip>
                                            </TableCell>
                                            <TableCell>{groupDetail.groupIntroduction}</TableCell>
                                            <TableCell>
                                                <Chip color={getSplitStrategyColor(groupDetail.splitStrategy)} variant="flat">
                                                    {getSplitStrategyLabel(groupDetail.splitStrategy)}
                                                </Chip>
                                            </TableCell>
                                            <TableCell>{getAIModelLabel(groupDetail.aiModel)}</TableCell>
                                            <TableCell>
                                                {recentMessageCounts[groupId] !== undefined ? <span className="font-semibold">{recentMessageCounts[groupId]}</span> : <Spinner size="sm" />}
                                            </TableCell>
                                            <TableCell>
                                                <div
                                                    ref={el => {
                                                        chartRefs.current[groupId] = el;
                                                    }}
                                                    style={{ width: "300px", height: "100px" }}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardBody>
                </Card>

                {/* <Card className="mt-6">
                    <CardHeader>
                        <h3 className="text-lg font-bold">使用说明</h3>
                    </CardHeader>
                    <CardBody>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <h4 className="font-semibold mb-2">分组策略</h4>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>
                                        <span className="font-medium">实时分组:</span>{" "}
                                        根据消息时间实时划分会话
                                    </li>
                                    <li>
                                        <span className="font-medium">累积分组:</span>{" "}
                                        将连续消息累积为一个会话
                                    </li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-semibold mb-2">AI模型</h4>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>
                                        <span className="font-medium">GPT-3.5 Turbo:</span>{" "}
                                        快速且成本较低的模型
                                    </li>
                                    <li>
                                        <span className="font-medium">GPT-4:</span>{" "}
                                        更强大但成本较高的模型
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </CardBody>
                </Card> */}
            </section>
        </DefaultLayout>
    );
}
