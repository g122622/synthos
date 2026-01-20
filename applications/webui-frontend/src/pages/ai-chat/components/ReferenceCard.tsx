/**
 * RAG 参考来源卡片组件
 * 平铺展示参考来源，支持响应式多列布局
 */
import React from "react";
import { Card, CardBody, CardHeader, Chip, Progress, Link } from "@heroui/react";
import { Info, Users } from "lucide-react";
import { motion } from "framer-motion";

import TopicPopover from "@/components/topic/TopicPopover";

export interface ReferenceItemData {
    topicId: string;
    topic: string;
    relevance: number;
    // 搜索结果可选字段：话题详情摘要
    detail?: string;
    // 搜索结果可选字段：贡献者信息
    contributors?: string;
}

interface ReferenceCardProps {
    reference: ReferenceItemData;
    index: number;
    favoriteTopics: Record<string, boolean>;
    readTopics: Record<string, boolean>;
    onMarkAsRead: (topicId: string) => void;
    onToggleFavorite: (topicId: string) => void;
}

/**
 * 根据相关度百分比获取进度条颜色
 * @param relevancePercent 相关度百分比 (0-100)
 * @returns 颜色值
 */
const getRelevanceColor = (relevancePercent: number): "danger" | "warning" | "success" | "default" => {
    if (relevancePercent < 10) {
        return "danger"; // 红色
    } else if (relevancePercent < 20) {
        return "warning"; // 橙色
    } else if (relevancePercent < 40) {
        return "success"; // 黄色（使用default作为中性色）
    } else {
        return "success"; // 绿色
    }
};

/**
 * 参考来源卡片组件
 */
const ReferenceCard: React.FC<ReferenceCardProps> = ({ reference, index, favoriteTopics, readTopics, onMarkAsRead, onToggleFavorite }) => {
    const relevancePercent = Math.round(reference.relevance * 100);
    const relevanceColor = getRelevanceColor(relevancePercent);

    return (
        <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 20 }} transition={{ duration: 0.3, delay: index * 0.05 }}>
            <Card
                className={`
                    h-full transition-all hover:shadow-lg p-1 pt-0
                `}
                shadow="sm"
            >
                <CardHeader className="flex gap-2 pb-2">
                    <Chip color="secondary" size="sm" variant="flat">
                        #{index + 1}
                    </Chip>
                    <Chip color={relevanceColor} size="sm" variant="flat">
                        {relevancePercent}%
                    </Chip>
                    {/* 查看详情链接 */}
                    <div className="absolute top-2 right-3">
                        <Link className="text-xs text-primary" href={`/ai-digest?topicId=${reference.topicId}`}>
                            查看详情 →
                        </Link>
                    </div>
                </CardHeader>
                <CardBody className="gap-3 flex flex-col justify-between h-full">
                    {/* 话题标题 - 支持悬停查看详情 */}
                    <TopicPopover favoriteTopics={favoriteTopics} readTopics={readTopics} topicId={reference.topicId} onMarkAsRead={onMarkAsRead} onToggleFavorite={onToggleFavorite}>
                        <div className="inline-flex items-center gap-1 cursor-help group">
                            <span className="text-sm font-medium underline decoration-dotted group-hover:text-primary transition-colors line-clamp-2">{reference.topic}</span>
                            <Info className="w-3 h-3 text-default-400 flex-shrink-0" />
                        </div>
                    </TopicPopover>

                    {/* 搜索结果：详情与贡献者 */}
                    {(reference.detail || reference.contributors) && (
                        <div className="space-y-2">
                            {reference.detail && <p className="text-xs text-default-600 line-clamp-3">{reference.detail}</p>}
                            {reference.contributors && (
                                <div className="flex items-center gap-2">
                                    <Users className="w-3.5 h-3.5 text-default-400" />
                                    <p className="text-xs text-default-500 line-clamp-1">{reference.contributors}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 相关度进度条 - 始终可见 */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-default-500">
                            <span>相关度</span>
                            <span>{relevancePercent}%</span>
                        </div>
                        <Progress aria-label="相关度" className="max-w-full" color={relevanceColor} size="sm" value={relevancePercent} />
                    </div>
                </CardBody>
            </Card>
        </motion.div>
    );
};

export default ReferenceCard;
