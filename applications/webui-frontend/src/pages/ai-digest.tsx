import type { AIDigestResult } from "@/types/topic";

import { useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/table";
import { Tabs, Tab } from "@heroui/tabs";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { Spinner } from "@heroui/spinner";
import { useAsyncList } from "@react-stately/data";

import { getAIDigestResultsBySessionId, getAIDigestResultByTopicId, isSessionSummarized } from "@/api/basicApi";
import { title } from "@/components/primitives";
import DefaultLayout from "@/layouts/default";
import { formatRelativeTime } from "@/util/format";

export default function AIDigestPage() {
    const [sessionId, setSessionId] = useState<string>("");
    const [topicId, setTopicId] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isSessionChecked, setIsSessionChecked] = useState<boolean>(false);
    const [isSummarized, setIsSummarized] = useState<boolean>(false);

    // 按会话ID获取摘要结果
    const sessionDigestList = useAsyncList<AIDigestResult>({
        async load({}) {
            if (!sessionId) {
                return {
                    items: []
                };
            }

            setIsLoading(true);
            try {
                const response = await getAIDigestResultsBySessionId(sessionId);

                setIsLoading(false);

                if (response.success) {
                    return {
                        items: response.data
                    };
                } else {
                    console.error("获取会话摘要失败:", response.message);

                    return {
                        items: []
                    };
                }
            } catch (error) {
                setIsLoading(false);
                console.error("获取会话摘要失败:", error);

                return {
                    items: []
                };
            }
        }
    });

    // 按主题ID获取摘要结果
    const [topicDigest, setTopicDigest] = useState<AIDigestResult | null>(null);
    const [isTopicLoading, setIsTopicLoading] = useState<boolean>(false);

    const fetchTopicDigest = async () => {
        if (!topicId) return;

        setIsTopicLoading(true);
        try {
            const response = await getAIDigestResultByTopicId(topicId);

            setIsTopicLoading(false);

            if (response.success) {
                setTopicDigest(response.data);
            } else {
                console.error("获取主题摘要失败:", response.message);
                setTopicDigest(null);
            }
        } catch (error) {
            setIsTopicLoading(false);
            console.error("获取主题摘要失败:", error);
            setTopicDigest(null);
        }
    };

    // 检查会话是否已摘要
    const checkSessionSummarized = async () => {
        if (!sessionId) return;

        try {
            const response = await isSessionSummarized(sessionId);

            if (response.success) {
                setIsSummarized(response.data.isSummarized);
                setIsSessionChecked(true);
            }
        } catch (error) {
            console.error("检查会话摘要状态失败:", error);
        }
    };

    // 查询会话摘要
    const handleQuerySessionDigest = () => {
        sessionDigestList.reload();
        checkSessionSummarized();
    };

    // 查询主题摘要
    const handleQueryTopicDigest = () => {
        fetchTopicDigest();
    };

    return (
        <DefaultLayout>
            <section className="flex flex-col gap-4 py-8 md:py-10">
                <div className="flex flex-col items-center justify-center gap-4">
                    <h1 className={title()}>AI摘要结果</h1>
                    <p className="text-default-600 max-w-2xl text-center">浏览AI生成的聊天摘要结果，支持按会话或主题查看详细内容</p>
                </div>

                <Tabs aria-label="摘要查询选项" className="mt-6">
                    <Tab key="session" title="按会话查询">
                        <Card className="mt-4">
                            <CardHeader>
                                <div className="flex flex-col md:flex-row gap-4 items-end w-full">
                                    <div className="flex-1 w-full">
                                        <Input className="max-w-xs" label="会话ID" placeholder="请输入会话ID" value={sessionId} onValueChange={setSessionId} />
                                    </div>
                                    <div className="flex gap-2">
                                        <Button color="primary" isLoading={isLoading} onPress={handleQuerySessionDigest}>
                                            {isLoading ? <Spinner size="sm" /> : "查询"}
                                        </Button>
                                    </div>
                                </div>
                                {isSessionChecked && (
                                    <div className={`mt-2 ${isSummarized ? "text-success" : "text-warning"}`}>{isSummarized ? "✅ 该会话已完成摘要" : "⚠️ 该会话尚未摘要或不存在"}</div>
                                )}
                            </CardHeader>
                            <CardBody>
                                {isLoading ? (
                                    <div className="flex justify-center items-center h-64">
                                        <Spinner size="lg" />
                                    </div>
                                ) : (
                                    <Table aria-label="会话摘要结果">
                                        <TableHeader>
                                            <TableColumn>主题</TableColumn>
                                            <TableColumn>参与者</TableColumn>
                                            <TableColumn>模型</TableColumn>
                                            <TableColumn>更新时间</TableColumn>
                                            <TableColumn>详情</TableColumn>
                                        </TableHeader>
                                        <TableBody emptyContent={"未找到相关摘要结果"}>
                                            {sessionDigestList.items.map(digest => (
                                                <TableRow key={digest.topicId}>
                                                    <TableCell className="font-semibold">{digest.topic}</TableCell>
                                                    <TableCell>{digest.contributors}</TableCell>
                                                    <TableCell>{digest.modelName}</TableCell>
                                                    <TableCell>
                                                        <span title={new Date(digest.updateTime).toLocaleString("zh-CN")}>{formatRelativeTime(digest.updateTime)}</span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="max-w-md truncate" title={digest.detail}>
                                                            {digest.detail}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardBody>
                        </Card>
                    </Tab>

                    <Tab key="topic" title="按主题查询">
                        <Card className="mt-4">
                            <CardHeader>
                                <div className="flex flex-col md:flex-row gap-4 items-end w-full">
                                    <div className="flex-1 w-full">
                                        <Input className="max-w-xs" label="主题ID" placeholder="请输入主题ID" value={topicId} onValueChange={setTopicId} />
                                    </div>
                                    <div className="flex gap-2">
                                        <Button color="primary" isLoading={isTopicLoading} onPress={handleQueryTopicDigest}>
                                            {isTopicLoading ? <Spinner size="sm" /> : "查询"}
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardBody>
                                {isTopicLoading ? (
                                    <div className="flex justify-center items-center h-64">
                                        <Spinner size="lg" />
                                    </div>
                                ) : topicDigest ? (
                                    <Accordion selectionMode="multiple">
                                        <AccordionItem key="1" aria-label="主题信息" title="主题信息">
                                            <div className="flex flex-col gap-2">
                                                <div>
                                                    <span className="font-semibold">主题ID:</span> {topicDigest.topicId}
                                                </div>
                                                <div>
                                                    <span className="font-semibold">会话ID:</span> {topicDigest.sessionId}
                                                </div>
                                                <div>
                                                    <span className="font-semibold">主题:</span> {topicDigest.topic}
                                                </div>
                                                <div>
                                                    <span className="font-semibold">参与者:</span> {topicDigest.contributors}
                                                </div>
                                                <div>
                                                    <span className="font-semibold">模型:</span> {topicDigest.modelName}
                                                </div>
                                                <div>
                                                    <span className="font-semibold">更新时间:</span>{" "}
                                                    <span title={new Date(topicDigest.updateTime).toLocaleString("zh-CN")}>{formatRelativeTime(topicDigest.updateTime)}</span>
                                                </div>
                                            </div>
                                        </AccordionItem>
                                        <AccordionItem key="2" aria-label="摘要详情" title="摘要详情">
                                            <p>{topicDigest.detail}</p>
                                        </AccordionItem>
                                    </Accordion>
                                ) : topicId ? (
                                    <div className="text-center text-default-500 py-8">未找到ID为 {topicId} 的主题摘要</div>
                                ) : (
                                    <div className="text-center text-default-500 py-8">请输入主题ID进行查询</div>
                                )}
                            </CardBody>
                        </Card>
                    </Tab>
                </Tabs>

                <Card className="mt-6">
                    <CardHeader>
                        <h3 className="text-lg font-bold">导出功能</h3>
                    </CardHeader>
                    <CardBody>
                        <div className="flex gap-3">
                            <Button color="primary" variant="bordered">
                                导出为PDF
                            </Button>
                            <Button color="primary" variant="bordered">
                                导出为Word
                            </Button>
                            <Button color="primary" variant="bordered">
                                导出为Markdown
                            </Button>
                        </div>
                    </CardBody>
                </Card>
            </section>
        </DefaultLayout>
    );
}
