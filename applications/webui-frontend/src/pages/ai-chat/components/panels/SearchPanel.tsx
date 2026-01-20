/**
 * 语义搜索结果面板
 */
import type { SearchResultItem } from "@/api/ragApi";

import { Spinner } from "@heroui/spinner";
import { Search } from "lucide-react";
import { motion } from "framer-motion";

import ReferenceList from "../ReferenceList";
import EmptyState from "../EmptyState";

interface SearchPanelProps {
    searchLoading: boolean;
    searchResults: SearchResultItem[];
    searchQuery: string;
    favoriteTopics: Record<string, boolean>;
    readTopics: Record<string, boolean>;
    onMarkAsRead: (topicId: string) => void;
    onToggleFavorite: (topicId: string) => void;
}

export default function SearchPanel({ searchLoading, searchResults, searchQuery, favoriteTopics, readTopics, onMarkAsRead, onToggleFavorite }: SearchPanelProps) {
    if (searchLoading) {
        return (
            <motion.div animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-12 gap-4" initial={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                <Spinner color="primary" size="lg" />
                <p className="text-default-500">搜索中...</p>
            </motion.div>
        );
    }

    if (searchResults.length > 0) {
        const mapped = searchResults.map(item => {
            const relevance = Math.max(0, Math.min(1, 1 - item.distance));

            return {
                topicId: item.topicId,
                topic: item.topic,
                relevance,
                detail: item.detail,
                contributors: item.contributors
            };
        });

        return (
            <ReferenceList
                defaultCollapsed={false}
                favoriteTopics={favoriteTopics}
                icon={<Search className="w-6 h-6 text-secondary" />}
                readTopics={readTopics}
                references={mapped}
                title="搜索结果"
                onMarkAsRead={onMarkAsRead}
                onToggleFavorite={onToggleFavorite}
            />
        );
    }

    if (searchQuery) {
        return (
            <motion.div animate={{ opacity: 1, y: 0 }} className="text-center py-12" initial={{ opacity: 0, y: 20 }} transition={{ duration: 0.3 }}>
                <p className="text-default-500">未找到相关话题，请尝试其他关键词</p>
            </motion.div>
        );
    }

    return <EmptyState mode="search" />;
}
