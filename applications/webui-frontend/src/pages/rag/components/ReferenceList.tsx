/**
 * RAG 参考来源列表组件
 * 以响应式网格布局展示所有参考来源
 */
import React, { useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";

import ReferenceCard, { ReferenceItemData } from "./ReferenceCard";

interface ReferenceListProps {
    references: ReferenceItemData[];
    favoriteTopics: Record<string, boolean>;
    readTopics: Record<string, boolean>;
    onMarkAsRead: (topicId: string) => void;
    onToggleFavorite: (topicId: string) => void;
}

/**
 * 参考来源列表组件
 * 使用响应式Grid布局展示多个参考来源卡片
 */
const ReferenceList: React.FC<ReferenceListProps> = ({ references, favoriteTopics, readTopics, onMarkAsRead, onToggleFavorite }) => {
    const [isCollapsed, setIsCollapsed] = useState(true);

    if (references.length === 0) {
        return null;
    }

    return (
        <Card className="w-full shadow-none bg-transparent">
            <CardHeader className="flex gap-3">
                <BookOpen className="w-6 h-6 text-secondary" />
                <div className="flex flex-col flex-1">
                    <p className="text-lg font-semibold">参考来源</p>
                    <p className="text-small text-default-500">共 {references.length} 个相关话题</p>
                </div>
                <button className="flex items-center gap-1 text-small text-default-500 hover:text-default-700 transition-colors" onClick={() => setIsCollapsed(!isCollapsed)}>
                    {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    {isCollapsed ? "展开" : "折叠"}
                </button>
            </CardHeader>
            {!isCollapsed && (
                <CardBody className="overflow-hidden">
                    {/* 响应式网格布局 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-3">
                        {references.map((reference, index) => (
                            <ReferenceCard
                                key={reference.topicId}
                                favoriteTopics={favoriteTopics}
                                index={index}
                                readTopics={readTopics}
                                reference={reference}
                                onMarkAsRead={onMarkAsRead}
                                onToggleFavorite={onToggleFavorite}
                            />
                        ))}
                    </div>
                </CardBody>
            )}
        </Card>
    );
};

export default ReferenceList;
