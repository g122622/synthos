import { useState, useEffect, useCallback } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Pagination } from "@heroui/pagination";
import { Spinner } from "@heroui/spinner";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Tabs, Tab, Chip, Calendar, Select, SelectItem } from "@heroui/react";
import { FileText, RefreshCw, Plus } from "lucide-react";
import { today, getLocalTimeZone, CalendarDate } from "@internationalized/date";

import ReportCard from "./components/ReportCard";
import ReportDetailModal from "./components/ReportDetailModal";

import { Report, ReportType, getReportsPaginated, getReportsByDate, triggerReportGenerate } from "@/api/reportApi";
import { title } from "@/components/primitives";
import DefaultLayout from "@/layouts/default";
import { Notification } from "@/util/Notification";

export default function ReportsPage() {
    // 状态管理
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [page, setPage] = useState<number>(1);
    const [total, setTotal] = useState<number>(0);
    const [pageSize] = useState<number>(10);
    const [selectedType, setSelectedType] = useState<ReportType | "all">("all");

    // 日历视图相关
    const [selectedDate, setSelectedDate] = useState<CalendarDate>(today(getLocalTimeZone()));
    const [dateReports, setDateReports] = useState<Report[]>([]);
    const [dateLoading, setDateLoading] = useState<boolean>(false);

    // 详情弹窗
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

    // 视图模式: list(列表) | calendar(日历)
    const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

    // 手动生成日报相关
    const [generateType, setGenerateType] = useState<ReportType>("half-daily");
    const [generating, setGenerating] = useState<boolean>(false);

    // 加载日报列表
    const fetchReports = useCallback(async () => {
        setLoading(true);
        try {
            const type = selectedType === "all" ? undefined : selectedType;
            const response = await getReportsPaginated(page, pageSize, type);

            if (response.success) {
                setReports(response.data.reports);
                setTotal(response.data.total);
            } else {
                Notification.error({
                    title: "加载失败",
                    description: "无法获取日报列表"
                });
            }
        } catch (error) {
            console.error("获取日报列表失败:", error);
            Notification.error({
                title: "加载失败",
                description: "无法获取日报列表"
            });
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, selectedType]);

    // 加载指定日期的日报
    const fetchReportsByDate = useCallback(async (date: CalendarDate) => {
        setDateLoading(true);
        try {
            const jsDate = date.toDate(getLocalTimeZone());
            const response = await getReportsByDate(jsDate.getTime());

            if (response.success) {
                setDateReports(response.data);
            } else {
                setDateReports([]);
            }
        } catch (error) {
            console.error("获取日期日报失败:", error);
            setDateReports([]);
        } finally {
            setDateLoading(false);
        }
    }, []);

    // 初始加载
    useEffect(() => {
        if (viewMode === "list") {
            fetchReports();
        }
    }, [fetchReports, viewMode]);

    // 日期变化时加载日报
    useEffect(() => {
        if (viewMode === "calendar") {
            fetchReportsByDate(selectedDate);
        }
    }, [selectedDate, viewMode, fetchReportsByDate]);

    // 切换类型时重置页码
    useEffect(() => {
        setPage(1);
    }, [selectedType]);

    // 打开详情弹窗
    const openReportDetail = (report: Report) => {
        setSelectedReport(report);
        setIsModalOpen(true);
    };

    // 关闭详情弹窗
    const closeReportDetail = () => {
        setIsModalOpen(false);
        setSelectedReport(null);
    };

    // 计算总页数
    const totalPages = Math.ceil(total / pageSize);

    // 日历日期变化
    const handleDateChange = (date: CalendarDate) => {
        setSelectedDate(date);
    };

    // 快捷跳转到今天
    const goToToday = () => {
        setSelectedDate(today(getLocalTimeZone()));
    };

    // 手动生成日报
    const handleGenerateReport = async () => {
        setGenerating(true);
        try {
            const response = await triggerReportGenerate(generateType);

            if (response.success && response.data.success) {
                Notification.success({
                    title: "生成任务已提交",
                    description: response.data.message
                });
            } else {
                Notification.error({
                    title: "生成失败",
                    description: response.data?.message || "触发日报生成失败"
                });
            }
        } catch (error) {
            console.error("触发日报生成失败:", error);
            Notification.error({
                title: "生成失败",
                description: "触发日报生成失败"
            });
        } finally {
            setGenerating(false);
        }
    };

    // 日报类型选项
    const reportTypeOptions = [
        { key: "half-daily", label: "半日报（过去12小时）" },
        { key: "weekly", label: "周报（过去7天）" },
        { key: "monthly", label: "月报（过去30天）" }
    ];

    return (
        <DefaultLayout>
            <section className="flex flex-col gap-4 py-0 md:py-10">
                {/* 页面标题 */}
                <div className="hidden sm:flex items-center justify-center">
                    <img alt="logo" className="w-21 mr-5" src="./logo.webp" />
                    <div className="flex flex-col items-center justify-center gap-4">
                        <h1 className={title()}>日报中心</h1>
                        <p className="text-default-600 max-w-2xl text-center">查看群聊话题的定期汇总报告，包含统计数据和 AI 生成的综述</p>
                    </div>
                </div>

                {/* 主内容区 */}
                <Card className="mt-0 md:mt-6">
                    <CardHeader className="flex flex-row justify-between items-center pl-7 pr-7 gap-4 flex-wrap">
                        <div className="flex flex-row items-center gap-4">
                            <h2 className="text-xl font-bold">
                                <FileText className="inline-block mr-2" size={20} />
                                日报列表
                            </h2>
                            <Chip color="primary" size="sm" variant="flat">
                                共 {total} 份报告
                            </Chip>
                        </div>

                        {/* 视图切换和筛选 */}
                        <div className="flex flex-row items-center gap-4 flex-wrap">
                            {/* 视图模式切换 */}
                            <Tabs aria-label="视图模式" selectedKey={viewMode} size="sm" onSelectionChange={key => setViewMode(key as "list" | "calendar")}>
                                <Tab key="list" title="列表视图" />
                                <Tab key="calendar" title="日历视图" />
                            </Tabs>

                            {/* 报告类型筛选（仅列表视图） */}
                            {viewMode === "list" && (
                                <Tabs aria-label="报告类型" selectedKey={selectedType} size="sm" onSelectionChange={key => setSelectedType(key as ReportType | "all")}>
                                    <Tab key="all" title="全部" />
                                    <Tab key="half-daily" title="半日报" />
                                    <Tab key="weekly" title="周报" />
                                    <Tab key="monthly" title="月报" />
                                </Tabs>
                            )}

                            {/* 刷新按钮 */}
                            <Button
                                color="primary"
                                isLoading={loading || dateLoading}
                                size="sm"
                                startContent={<RefreshCw size={16} />}
                                variant="flat"
                                onPress={() => {
                                    if (viewMode === "list") {
                                        fetchReports();
                                    } else {
                                        fetchReportsByDate(selectedDate);
                                    }
                                }}
                            >
                                刷新
                            </Button>

                            {/* 手动生成日报 */}
                            <div className="flex flex-row items-center gap-2">
                                <Select
                                    aria-label="选择日报类型"
                                    className="w-44"
                                    selectedKeys={[generateType]}
                                    size="sm"
                                    onSelectionChange={keys => {
                                        const selected = Array.from(keys)[0] as ReportType;

                                        if (selected) {
                                            setGenerateType(selected);
                                        }
                                    }}
                                >
                                    {reportTypeOptions.map(option => (
                                        <SelectItem key={option.key}>{option.label}</SelectItem>
                                    ))}
                                </Select>
                                <Button color="success" isLoading={generating} size="sm" startContent={<Plus size={16} />} onPress={handleGenerateReport}>
                                    生成
                                </Button>
                            </div>
                        </div>
                    </CardHeader>

                    <CardBody>
                        {viewMode === "list" ? (
                            /* 列表视图 */
                            loading ? (
                                <div className="flex justify-center items-center h-64">
                                    <Spinner size="lg" />
                                </div>
                            ) : reports.length > 0 ? (
                                <div className="flex flex-col gap-4">
                                    <ScrollShadow className="max-h-[calc(100vh-320px)]">
                                        <div className="flex flex-col gap-3 p-2">
                                            {reports.map(report => (
                                                <ReportCard key={report.reportId} report={report} onClick={() => openReportDetail(report)} />
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
                                    <FileText className="mx-auto mb-4 text-default-400" size={48} />
                                    <p className="text-default-500">暂无日报数据</p>
                                    <p className="text-default-400 text-sm mt-2">日报会在配置的时间自动生成</p>
                                </div>
                            )
                        ) : (
                            /* 日历视图 */
                            <div className="flex flex-col lg:flex-row gap-6">
                                {/* 日历选择器 */}
                                <div className="flex flex-col items-center gap-4">
                                    <Calendar aria-label="选择日期" value={selectedDate} onChange={handleDateChange} />
                                    <Button color="primary" size="sm" variant="flat" onPress={goToToday}>
                                        回到今天
                                    </Button>
                                </div>

                                {/* 日期对应的日报列表 */}
                                <div className="flex-1">
                                    <div className="mb-4">
                                        <h3 className="text-lg font-semibold">
                                            {selectedDate.year}年{selectedDate.month}月{selectedDate.day}日 的日报
                                        </h3>
                                    </div>

                                    {dateLoading ? (
                                        <div className="flex justify-center items-center h-32">
                                            <Spinner size="md" />
                                        </div>
                                    ) : dateReports.length > 0 ? (
                                        <div className="flex flex-col gap-3">
                                            {dateReports.map(report => (
                                                <ReportCard key={report.reportId} report={report} onClick={() => openReportDetail(report)} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 bg-default-50 rounded-lg">
                                            <p className="text-default-500">该日期暂无日报</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardBody>
                </Card>
            </section>

            {/* 日报详情弹窗 */}
            <ReportDetailModal isOpen={isModalOpen} report={selectedReport} onClose={closeReportDetail} />
        </DefaultLayout>
    );
}
