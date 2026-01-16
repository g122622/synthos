import React, { useEffect, useState } from "react";
import { Card, CardBody, Button } from "@heroui/react";
import ReactECharts from "echarts-for-react";
import { FolderOpen } from "lucide-react";

import { SystemStats, getLatestSystemStats, getSystemStatsHistory } from "../../api/systemMonitor";
import { formatBytes } from "../../util/format"; // Assuming you have or we will create similar

import DefaultLayout from "@/layouts/default";

// 图标（简单SVG或Lucide）
const RefreshIcon = () => (
    <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
    </svg>
);

const WarningIcon = () => (
    <svg fill="none" height="24" stroke="orange" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" x2="12" y1="9" y2="13" />
        <line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
);

const ModuleChart: React.FC<{ history: SystemStats[]; moduleName: string; title: string }> = ({ history, moduleName, title }) => {
    const dataCPU = history.map(h => [h.timestamp, h.modules[moduleName]?.cpu || 0]);
    const dataMem = history.map(h => [h.timestamp, (h.modules[moduleName]?.memory || 0) / (1024 * 1024)]); // 兆字节（MB）

    const option = {
        title: { text: title, textStyle: { color: "#ccc", fontSize: 14 } },
        tooltip: { trigger: "axis" },
        legend: { data: ["CPU (%)", "内存 (MB)"], textStyle: { color: "#ccc" } },
        grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
        xAxis: { type: "time", axisLabel: { color: "#888" } },
        yAxis: [
            { type: "value", name: "CPU %", axisLabel: { color: "#888" }, splitLine: { lineStyle: { color: "#333" } } },
            { type: "value", name: "内存 MB", axisLabel: { color: "#888" }, splitLine: { show: false } }
        ],
        series: [
            { name: "CPU (%)", type: "line", data: dataCPU, showSymbol: false, smooth: true, lineStyle: { width: 1 } },
            { name: "内存 (MB)", type: "line", yAxisIndex: 1, data: dataMem, showSymbol: false, smooth: true, lineStyle: { width: 1 } }
        ]
    };

    return <ReactECharts option={option} style={{ height: "200px", width: "100%" }} />;
};

const StorageCard: React.FC<{ title: string; desc: string; stats: { count: number; size: number } | undefined; iconColor: string; icon: React.ReactNode }> = ({
    title,
    desc,
    stats,
    iconColor,
    icon
}) => (
    <Card className="w-full border-none mb-4">
        <CardBody className="flex flex-row items-center justify-between p-4">
            <div className="flex flex-row items-center gap-4">
                <div className={`p-3 rounded-full bg-opacity-20 flex items-center justify-center`} style={{ backgroundColor: `${iconColor}20` }}>
                    {icon}
                </div>
                <div>
                    <h3 className=" font-bold text-lg">{title}</h3>
                    <p className="text-gray-500 text-sm">{desc}</p>
                    <p className="text-xs mt-1">{stats ? `${stats.count} 个文件 | ${formatBytes(stats.size)}` : "加载中..."}</p>
                </div>
            </div>
            <div className="flex gap-2">
                <Button color="primary" size="sm" startContent={<FolderOpen size={16} />} variant="flat">
                    打开
                </Button>
            </div>
        </CardBody>
    </Card>
);

const SystemMonitorPage: React.FC = () => {
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [history, setHistory] = useState<SystemStats[]>([]);

    useEffect(() => {
        getSystemStatsHistory().then(setHistory);
        const interval = setInterval(async () => {
            const latest = await getLatestSystemStats();

            setStats(latest);
            setHistory(prev => {
                const newHistory = [...prev, latest];

                if (newHistory.length > 300) newHistory.shift();

                return newHistory;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const CircleIcon = ({ color }: { color: string }) => <div style={{ width: 24, height: 24, borderRadius: "50%", border: `2px solid ${color}` }} />;

    // 总存储空间
    const totalSize = stats?.storage.totalSize || 0;

    return (
        <DefaultLayout>
            <div className="p-6 min-h-screen ">
                {/* 顶部栏 */}
                <div className="flex justify-between items-end mb-6 border-b border-gray-800 pb-4">
                    <div>
                        <h1 className="text-3xl font-bold  mb-1">本地存储管理</h1>
                        <p className="text-gray-400 text-sm">管理 ChatLab 的本地数据文件</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span>总存储空间：{formatBytes(totalSize)}</span>
                        <Button isIconOnly size="sm" variant="light" onClick={() => getSystemStatsHistory().then(setHistory)}>
                            <RefreshIcon />
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 左侧：存储卡片 */}
                    <div className="space-y-4">
                        <StorageCard
                            desc="导入的聊天历史分析数据"
                            icon={<CircleIcon color="#4ade80" />}
                            iconColor="#4ade80" // Green
                            stats={stats?.storage.chatRecordDB}
                            title="聊天记录数据库"
                        />
                        <StorageCard
                            desc="AI 对话历史与配置"
                            icon={<CircleIcon color="#a78bfa" />}
                            iconColor="#a78bfa" // Purple
                            stats={stats?.storage.aiDialogueDB}
                            title="AI 对话数据库"
                        />
                        <StorageCard
                            desc="为AI模型提供长期记忆"
                            icon={<CircleIcon color="#f472b6" />}
                            iconColor="#f472b6" // Pink
                            stats={stats?.storage.vectorDB}
                            title="向量数据库"
                        />
                        <StorageCard
                            desc="预处理与后端的持久化键值存储"
                            icon={<CircleIcon color="#fbbf24" />}
                            iconColor="#fbbf24" // Amber
                            stats={
                                stats
                                    ? {
                                          count: stats.storage.kvStoreBackend.count + stats.storage.kvStorePersistent.count,
                                          size: stats.storage.kvStoreBackend.size + stats.storage.kvStorePersistent.size
                                      }
                                    : undefined
                            }
                            title="KV存储"
                        />
                        <StorageCard
                            desc="应用运行日志"
                            icon={<CircleIcon color="#60a5fa" />}
                            iconColor="#60a5fa" // Blue
                            stats={stats?.storage.logs}
                            title="日志文件"
                        />

                        {/* 警告区域 */}
                        <Card className="bg-orange-500/10 border border-orange-500/20">
                            <CardBody className="flex flex-row items-start gap-3 p-4">
                                <WarningIcon />
                                <div>
                                    <h4 className="text-orange-500 font-bold mb-1">注意</h4>
                                    <ul className="text-orange-400/80 text-sm list-disc list-inside space-y-1">
                                        <li>日志文件主要用于调试。</li>
                                        <li>为安全起见，监控删除功能已禁用。</li>
                                    </ul>
                                </div>
                            </CardBody>
                        </Card>
                    </div>

                    {/* 右侧：资源图表 */}
                    <div className="space-y-6">
                        <Card className="p-4">
                            <h3 className="text-lg font-bold mb-4">模块资源监控</h3>
                            <div className="grid grid-cols-1 gap-6">
                                {/* 可列出已知模块以保持顺序 */}
                                {["ai-model", "orchestrator", "preprocessing", "webui-backend"].map(mod => (
                                    <div key={mod}>
                                        <ModuleChart history={history} moduleName={mod} title={mod.toUpperCase()} />
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </DefaultLayout>
    );
};

export default SystemMonitorPage;
