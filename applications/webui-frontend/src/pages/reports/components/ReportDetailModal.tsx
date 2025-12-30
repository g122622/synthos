import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Chip, Divider, Card, CardBody, Link } from "@heroui/react";
import { FileText, Clock, Users, TrendingUp, Calendar, Bot, ExternalLink, Check } from "lucide-react";

import { Report, ReportType } from "@/api/reportApi";
import MarkdownRenderer from "@/components/MarkdownRenderer";

interface ReportDetailModalProps {
    report: Report | null;
    isOpen: boolean;
    onClose: () => void;
    readReports?: Record<string, boolean>;
    onMarkAsRead?: (reportId: string) => Promise<void>;
}

export default function ReportDetailModal({ report, isOpen, onClose, readReports = {}, onMarkAsRead }: ReportDetailModalProps) {
    if (!report) return null;

    // 格式化时间
    const formatDateTime = (timestamp: number): string => {
        if (!timestamp) return "未知";
        const date = new Date(timestamp);

        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    };

    // 格式化时间段
    const formatPeriod = (timeStart: number, timeEnd: number): string => {
        const start = new Date(timeStart);
        const end = new Date(timeEnd);

        const formatDate = (d: Date) => `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
        const formatTime = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

        if (start.toDateString() === end.toDateString()) {
            return `${formatDate(start)} ${formatTime(start)} - ${formatTime(end)}`;
        } else {
            return `${formatDate(start)} ${formatTime(start)} - ${formatDate(end)} ${formatTime(end)}`;
        }
    };

    // 获取报告类型配置
    const getTypeConfig = (type: ReportType): { label: string; color: "primary" | "secondary" | "success" } => {
        const configs: Record<ReportType, { label: string; color: "primary" | "secondary" | "success" }> = {
            "half-daily": { label: "半日报", color: "primary" },
            weekly: { label: "周报", color: "secondary" },
            monthly: { label: "月报", color: "success" }
        };

        return configs[type];
    };

    const typeConfig = getTypeConfig(report.type);

    return (
        <Modal isOpen={isOpen} scrollBehavior="inside" size="3xl" onClose={onClose}>
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                        <Chip color={typeConfig.color} size="md" variant="flat">
                            {typeConfig.label}
                        </Chip>
                        <span className="text-lg font-semibold">{formatPeriod(report.timeStart, report.timeEnd)}</span>
                    </div>
                </ModalHeader>

                <ModalBody>
                    {/* 统计数据卡片 */}
                    <Card className="bg-gradient-to-r from-primary-50 to-secondary-50">
                        <CardBody>
                            <h3 className="text-md font-semibold mb-4 flex items-center gap-2">
                                <TrendingUp size={18} />
                                统计概览
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="flex flex-col items-center p-4 bg-white/50 rounded-lg">
                                    <FileText className="text-primary mb-2" size={24} />
                                    <span className="text-2xl font-bold text-primary">{report.statistics.topicCount}</span>
                                    <span className="text-sm text-default-600">话题总数</span>
                                </div>

                                <div className="flex flex-col items-center p-4 bg-white/50 rounded-lg">
                                    <Users className="text-secondary mb-2" size={24} />
                                    <span className="text-md font-semibold text-secondary text-center">
                                        {report.statistics.mostActiveGroups.length > 0 ? report.statistics.mostActiveGroups.slice(0, 2).join("、") : "暂无"}
                                    </span>
                                    <span className="text-sm text-default-600">最活跃群组</span>
                                </div>

                                <div className="flex flex-col items-center p-4 bg-white/50 rounded-lg">
                                    <Clock className="text-success mb-2" size={24} />
                                    <span className="text-2xl font-bold text-success">{report.statistics.mostActiveHour}:00</span>
                                    <span className="text-sm text-default-600">最活跃时段</span>
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    <Divider className="my-4" />

                    {/* 综述内容 */}
                    <div>
                        <h3 className="text-md font-semibold mb-3 flex items-center gap-2">
                            <Bot size={18} />
                            AI 综述
                            {report.model && (
                                <Chip color="default" size="sm" variant="flat">
                                    {report.model}
                                </Chip>
                            )}
                        </h3>

                        {report.isEmpty ? (
                            <div className="text-center py-8 bg-default-50 rounded-lg">
                                <p className="text-default-500">本时段暂无热门话题讨论</p>
                            </div>
                        ) : report.summaryStatus === "success" && report.summary ? (
                            <Card className="p-2">
                                <CardBody>
                                    <MarkdownRenderer content={report.summary} showCopyButton={false} />
                                </CardBody>
                            </Card>
                        ) : report.summaryStatus === "pending" ? (
                            <div className="text-center py-8 bg-warning-50 rounded-lg">
                                <Clock className="mx-auto mb-2 text-warning" size={24} />
                                <p className="text-warning-600">综述正在生成中...</p>
                            </div>
                        ) : (
                            <div className="text-center py-8 bg-danger-50 rounded-lg">
                                <p className="text-danger-600">综述生成失败</p>
                            </div>
                        )}
                    </div>

                    <Divider className="my-4" />

                    {/* 关联话题 */}
                    {report.topicIds.length > 0 && (
                        <div>
                            <h3 className="text-md font-semibold mb-3 flex items-center gap-2">
                                <FileText size={18} />
                                关联话题
                                <Chip color="default" size="sm" variant="flat">
                                    {report.topicIds.length} 个
                                </Chip>
                            </h3>
                            <p className="text-sm text-default-500 mb-3">点击下方链接查看话题详情</p>
                            <Link className="text-primary" href="/latest-topics">
                                <ExternalLink className="inline mr-1" size={14} />
                                前往最新话题页面查看
                            </Link>
                        </div>
                    )}

                    {/* 元信息 */}
                    <div className="mt-4 pt-4 border-t border-default-200">
                        <div className="flex flex-wrap gap-4 text-sm text-default-500">
                            <span className="flex items-center gap-1">
                                <Calendar size={14} />
                                生成时间：{formatDateTime(report.summaryGeneratedAt)}
                            </span>
                            <span className="flex items-center gap-1">
                                <Clock size={14} />
                                创建时间：{formatDateTime(report.createdAt)}
                            </span>
                        </div>
                    </div>
                </ModalBody>

                <ModalFooter>
                    {onMarkAsRead && !readReports[report.reportId] && (
                        <Button
                            color="primary"
                            startContent={<Check size={16} />}
                            variant="flat"
                            onPress={async () => {
                                await onMarkAsRead(report.reportId);
                                onClose();
                            }}
                        >
                            标记已读
                        </Button>
                    )}
                    <Button color="primary" variant="light" onPress={onClose}>
                        关闭
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
