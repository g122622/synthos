import React, { cloneElement, isValidElement, useCallback, useEffect, useState } from "react";
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import { Spinner } from "@heroui/spinner";

import TopicCard from "./TopicCard";

import { AIDigestResult } from "@/types/app";
import { getAIDigestResultByTopicId } from "@/api/basicApi";

function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(false);

    useEffect(() => {
        const media = window.matchMedia(query);
        const sync = () => setMatches(media.matches);

        sync();
        media.addEventListener("change", sync);

        return () => media.removeEventListener("change", sync);
    }, [query]);

    return matches;
}

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
    const isMobile = useMediaQuery("(max-width: 767px)");

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

    const open = useCallback(() => handleOpenChange(true), [handleOpenChange]);

    const content = (
        <div className="py-2">
            {isLoading ? (
                <div className="flex justify-center py-8">
                    <Spinner label="加载话题详情..." size="lg" />
                </div>
            ) : topicDetail ? (
                <TopicCard favoriteTopics={favoriteTopics} interestScore={interestScore} readTopics={readTopics} topic={topicDetail} onMarkAsRead={onMarkAsRead} onToggleFavorite={onToggleFavorite} />
            ) : (
                <div className="text-center py-8 text-default-500">无法加载话题详情</div>
            )}
        </div>
    );

    if (isMobile) {
        let mobileTrigger: React.ReactNode;

        if (isValidElement(children)) {
            const childAny = children as any;
            const childOnClick = childAny.props?.onClick;
            const childOnPress = childAny.props?.onPress;

            mobileTrigger = cloneElement(children as React.ReactElement, {
                onClick: (event: any) => {
                    childOnClick?.(event);
                    open();
                },
                onPress: (event: any) => {
                    childOnPress?.(event);
                    open();
                }
            });
        } else {
            mobileTrigger = (
                <span
                    role="button"
                    tabIndex={0}
                    onClick={open}
                    onKeyDown={e => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            open();
                        }
                    }}
                >
                    {children}
                </span>
            );
        }

        return (
            <>
                {mobileTrigger}
                <Drawer isOpen={isOpen} placement="bottom" onOpenChange={handleOpenChange}>
                    <DrawerContent>
                        {_onClose => (
                            <>
                                <DrawerHeader className="flex flex-col gap-1">话题详情</DrawerHeader>
                                <DrawerBody className="max-h-[80vh] overflow-y-auto">{content}</DrawerBody>
                            </>
                        )}
                    </DrawerContent>
                </Drawer>
            </>
        );
    }

    return (
        <Popover isOpen={isOpen} placement="bottom" shouldBlockScroll={false} onOpenChange={handleOpenChange}>
            <PopoverTrigger>{children}</PopoverTrigger>
            <PopoverContent className={isLoading ? "w-[400px] max-h-[80vh] overflow-y-auto" : "w-[400px] max-h-[80vh] overflow-y-auto bg-transparent border-0 shadow-none"}>{content}</PopoverContent>
        </Popover>
    );
};

export default TopicPopover;
