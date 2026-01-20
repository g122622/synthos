/**
 * 话题引用卡片组件
 * 用于 RAG 与 Report 的 references 统一渲染
 */
import type { TopicReferenceItem } from "@/types/topicReference";

import React from "react";
import { Card, CardBody, CardHeader, Chip, Progress, Link } from "@heroui/react";
import { Info } from "lucide-react";
import { motion } from "framer-motion";

import TopicPopover from "@/components/topic/TopicPopover";

interface ReferenceCardProps {
    reference: TopicReferenceItem;
    index: number;
    favoriteTopics: Record<string, boolean>;
    readTopics: Record<string, boolean>;
    onMarkAsRead: (topicId: string) => void;
    onToggleFavorite: (topicId: string) => void;
}

/**
 * 根据相关度百分比获取进度条颜色
 */
const getRelevanceColor = (relevancePercent: number): "danger" | "warning" | "success" | "default" => {
    if (relevancePercent < 10) {
        return "danger";
    }
    if (relevancePercent < 20) {
        return "warning";
    }

    return "success";
};

const ReferenceCard: React.FC<ReferenceCardProps> = ({ reference, index, favoriteTopics, readTopics, onMarkAsRead, onToggleFavorite }) => {
    const relevancePercent = Math.round(reference.relevance * 100);
    const relevanceColor = getRelevanceColor(relevancePercent);

    return (
        <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 20 }} transition={{ duration: 0.3, delay: index * 0.05 }}>
            <Card className="h-full transition-all hover:shadow-lg p-1 pt-0" shadow="sm">
                <CardHeader className="flex gap-2 pb-2">
                    <Chip color="secondary" size="sm" variant="flat">
                        #{index + 1}
                    </Chip>
                    <Chip color={relevanceColor} size="sm" variant="flat">
                        {relevancePercent}%
                    </Chip>
                    <div className="absolute top-2 right-3">
                        <Link className="text-xs text-primary" href={`/ai-digest?topicId=${reference.topicId}`}>
                            查看详情 →
                        </Link>
                    </div>
                </CardHeader>

                <CardBody className="gap-3 flex flex-col justify-between h-full">
                    <TopicPopover favoriteTopics={favoriteTopics} readTopics={readTopics} topicId={reference.topicId} onMarkAsRead={onMarkAsRead} onToggleFavorite={onToggleFavorite}>
                        <div className="inline-flex items-center gap-1 cursor-help group">
                            <span className="text-sm font-medium underline decoration-dotted group-hover:text-primary transition-colors line-clamp-2">{reference.topic}</span>
                            <Info className="w-3 h-3 text-default-400 flex-shrink-0" />
                        </div>
                    </TopicPopover>

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
