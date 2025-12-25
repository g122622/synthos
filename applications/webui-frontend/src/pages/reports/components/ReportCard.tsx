import { Card, CardBody, Chip } from "@heroui/react";
import { FileText, Clock, Users, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";

import { Report, ReportType } from "@/api/reportApi";

interface ReportCardProps {
    report: Report;
    onClick: () => void;
}

export default function ReportCard({ report, onClick }: ReportCardProps) {
    // 格式化时间段
    const formatPeriod = (timeStart: number, timeEnd: number): string => {
        const start = new Date(timeStart);
        const end = new Date(timeEnd);

        const formatDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
        const formatTime = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

        if (start.toDateString() === end.toDateString()) {
            // 同一天
            return `${formatDate(start)} ${formatTime(start)} - ${formatTime(end)}`;
        } else {
            return `${formatDate(start)} ${formatTime(start)} - ${formatDate(end)} ${formatTime(end)}`;
        }
    };

    // 获取报告类型配置
    const getTypeConfig = (type: ReportType): { label: string; color: "primary" | "secondary" | "success" | "warning" | "danger" } => {
        const configs: Record<ReportType, { label: string; color: "primary" | "secondary" | "success" | "warning" | "danger" }> = {
            "half-daily": { label: "半日报", color: "primary" },
            weekly: { label: "周报", color: "secondary" },
            monthly: { label: "月报", color: "success" }
        };

        return configs[type];
    };

    // 获取状态配置
    const getStatusConfig = (status: string): { label: string; color: "success" | "warning" | "danger"; icon: React.ReactNode } => {
        const configs: Record<string, { label: string; color: "success" | "warning" | "danger"; icon: React.ReactNode }> = {
            success: { label: "已生成", color: "success", icon: <CheckCircle2 size={14} /> },
            pending: { label: "待生成", color: "warning", icon: <Clock size={14} /> },
            failed: { label: "生成失败", color: "danger", icon: <AlertCircle size={14} /> }
        };

        return configs[status] || configs["pending"];
    };

    const typeConfig = getTypeConfig(report.type);
    const statusConfig = getStatusConfig(report.summaryStatus);

    return (
        <Card isPressable className="w-full hover:bg-default-100 transition-colors" shadow="sm" onPress={onClick}>
            <CardBody className="p-4">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* 左侧：类型和时间 */}
                    <div className="flex items-center gap-3 min-w-[200px]">
                        <Chip color={typeConfig.color} size="sm" variant="flat">
                            {typeConfig.label}
                        </Chip>
                        <span className="text-default-600 text-sm">{formatPeriod(report.timeStart, report.timeEnd)}</span>
                    </div>

                    {/* 中间：统计数据 */}
                    <div className="flex items-center gap-6 flex-1">
                        <div className="flex items-center gap-2 text-default-600">
                            <FileText size={16} />
                            <span className="text-sm">{report.statistics.topicCount} 个话题</span>
                        </div>

                        {report.statistics.mostActiveGroups.length > 0 && (
                            <div className="flex items-center gap-2 text-default-600">
                                <Users size={16} />
                                <span className="text-sm truncate max-w-[150px]">{report.statistics.mostActiveGroups[0]}</span>
                            </div>
                        )}

                        <div className="flex items-center gap-2 text-default-600">
                            <TrendingUp size={16} />
                            <span className="text-sm">{report.statistics.mostActiveHour}:00 最活跃</span>
                        </div>
                    </div>

                    {/* 右侧：状态 */}
                    <div className="flex items-center gap-2">
                        {report.isEmpty ? (
                            <Chip color="default" size="sm" variant="flat">
                                空报告
                            </Chip>
                        ) : (
                            <Chip color={statusConfig.color} size="sm" startContent={statusConfig.icon} variant="flat">
                                {statusConfig.label}
                            </Chip>
                        )}
                    </div>
                </div>

                {/* 摘要预览 */}
                {!report.isEmpty && report.summary && (
                    <div className="mt-3 pt-3 border-t border-default-200">
                        <p className="text-default-600 text-sm line-clamp-2">{report.summary}</p>
                    </div>
                )}
            </CardBody>
        </Card>
    );
}
