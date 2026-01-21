import type { TopicReferenceItem } from "@/types/topicReference";

import React, { useMemo } from "react";
import { Card, CardBody, CardHeader, Tooltip } from "@heroui/react";
import { Hash } from "lucide-react";

import { countTopicReferencesInContent } from "@/util/topicReferenceParser";

interface TopicReferenceHeatmapProps {
    content: string;
    references: TopicReferenceItem[];
    className?: string;
    title?: string;
}

type HeatLevel = 0 | 1 | 2 | 3 | 4;

const _clampHeatLevel = (n: number): HeatLevel => {
    if (n <= 0) return 0;
    if (n >= 4) return 4;

    return n as HeatLevel;
};

const _getHeatLevel = (count: number, maxCount: number): HeatLevel => {
    if (count <= 0 || maxCount <= 0) {
        return 0;
    }

    const ratio = count / maxCount;

    if (ratio <= 0.25) {
        return 1;
    }
    if (ratio <= 0.5) {
        return 2;
    }
    if (ratio <= 0.75) {
        return 3;
    }

    return 4;
};

const _getLevelClassName = (level: HeatLevel): string => {
    // 参考 GitHub 的 5 档热力配色：0(灰) + 4 档渐深。
    // 这里优先复用项目里的语义色（primary/default），并兼容暗黑模式。
    switch (level) {
        case 0:
            return "bg-default-200 dark:bg-default-100";
        case 1:
            return "bg-primary-100 dark:bg-primary-900/40";
        case 2:
            return "bg-primary-200 dark:bg-primary-900/55";
        case 3:
            return "bg-primary-300 dark:bg-primary-900/70";
        case 4:
            return "bg-primary-400 dark:bg-primary-900/85";
        default:
            return "bg-default-200 dark:bg-default-100";
    }
};

const TopicReferenceHeatmap: React.FC<TopicReferenceHeatmapProps> = ({ content, references, className = "", title = "话题引用热力图" }) => {
    const counts = useMemo(() => countTopicReferencesInContent(content, references), [content, references]);
    const maxCount = useMemo(() => counts.reduce((acc, v) => Math.max(acc, v), 0), [counts]);
    const totalRefTopics = useMemo(() => counts.filter(v => v > 0).length, [counts]);

    if (references.length === 0) {
        return null;
    }

    const legendLevels = [0, 1, 2, 3, 4].map(v => _clampHeatLevel(v));

    return (
        <Card className={`w-full shadow-none bg-transparent ${className}`}>
            <CardHeader className="flex gap-3">
                <Hash className="w-6 h-6 text-secondary" />
                <div className="flex flex-col flex-1">
                    <p className="text-lg font-semibold">{title}</p>
                    <p className="text-small text-default-500">
                        共 {references.length} 个话题，正文总引用 {totalRefTopics} 个话题（最大单话题 {maxCount} 次）
                    </p>
                </div>

                <div className="hidden sm:flex items-center gap-2 text-xs text-default-500">
                    <span>少</span>
                    <div className="flex gap-1">
                        {legendLevels.map(lv => (
                            <div key={`legend-${lv}`} className={`w-3 h-3 rounded-[3px] ${_getLevelClassName(lv)}`} />
                        ))}
                    </div>
                    <span>多</span>
                </div>
            </CardHeader>

            <CardBody className="pt-0">
                <div className="flex flex-wrap gap-1">
                    {references.map((ref, index) => {
                        const n = index + 1;
                        const count = counts[index] ?? 0;
                        const level = _getHeatLevel(count, maxCount);

                        return (
                            <Tooltip
                                key={ref.topicId}
                                color="primary"
                                content={
                                    <div className="max-w-[320px]">
                                        <div className="font-medium">
                                            #{n} 引用 {count} 次
                                        </div>
                                        <div className="text-xs opacity-90 line-clamp-2">{ref.topic}</div>
                                    </div>
                                }
                                placement="top"
                            >
                                <button
                                    aria-label={`#${n} 引用 ${count} 次：${ref.topic}`}
                                    className={`w-[14px] h-[14px] rounded-[3px] ${_getLevelClassName(level)} outline-none ring-offset-1 focus-visible:ring-2 focus-visible:ring-primary`}
                                    type="button"
                                />
                            </Tooltip>
                        );
                    })}
                </div>
            </CardBody>
        </Card>
    );
};

export default TopicReferenceHeatmap;
