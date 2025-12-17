import { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { Spinner } from "@heroui/spinner";

import TopicCard from "./TopicCard";

import { AIDigestResult } from "@/types/app";
import { getAIDigestResultByTopicId } from "@/api/basicApi";

interface TopicPopoverProps {
    topicId: string;
    children: React.ReactNode;
    interestScore?: number;
    favoriteTopics?: Record<string, boolean>;
    readTopics?: Record<string, boolean>;
    onToggleFavorite?: (topicId: string) => void;
    onMarkAsRead?: (topicId: string) => void;
}

const TopicPopover: React.FC<TopicPopoverProps> = ({ children, favoriteTopics = {}, interestScore, onMarkAsRead, onToggleFavorite, readTopics = {}, topicId }) => {
    const [topicDetail, setTopicDetail] = useState<AIDigestResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    const loadTopicDetail = async () => {
        if (hasLoaded || isLoading) return;

        setIsLoading(true);
        try {
            const response = await getAIDigestResultByTopicId(topicId);

            if (response.success) {
                setTopicDetail(response.data);
                setHasLoaded(true);
            }
        } catch (error) {
            console.error("加载话题详情失败:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (open && !hasLoaded) {
            loadTopicDetail();
        }
    };

    return (
        <Popover isOpen={isOpen} placement="bottom" shouldBlockScroll={false} onOpenChange={handleOpenChange}>
            <PopoverTrigger>{children}</PopoverTrigger>
            <PopoverContent className="w-[500px] max-h-[80vh] overflow-y-auto">
                <div className="py-2">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Spinner label="加载话题详情..." size="lg" />
                        </div>
                    ) : topicDetail ? (
                        <TopicCard
                            favoriteTopics={favoriteTopics}
                            interestScore={interestScore}
                            readTopics={readTopics}
                            topic={topicDetail}
                            onMarkAsRead={onMarkAsRead}
                            onToggleFavorite={onToggleFavorite}
                        />
                    ) : (
                        <div className="text-center py-8 text-default-500">无法加载话题详情</div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default TopicPopover;
