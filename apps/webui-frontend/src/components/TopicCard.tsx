import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Button as HeroUIButton } from "@heroui/button";
import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/dropdown";

import { Copy, MoreVertical, Star, Check } from "lucide-react";

import { AIDigestResult } from "@/types/app";
import { Notification } from "@/util/Notification";
import {
    markTopicAsFavorite,
    removeTopicFromFavorites,
    markTopicAsRead
} from "@/api/readAndFavApi";
import EnhancedDetail from "./EnhancedDetail";

// 生成基于名称的颜色
const generateColorFromName = (name: string, isBackground: boolean = true): string => {
    const colors = [
        "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", 
        "#DDA0DD", "#98D8C8", "#FFD700", "#F8B500", "#6C5CE7"
    ];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const index = Math.abs(hash) % colors.length;
    return isBackground ? colors[index] + "20" : colors[index];
};

// 生成基于兴趣度的颜色
const generateColorFromInterestScore = (score: number, isBackground: boolean = true): string => {
    if (isBackground) {
        if (score > 0) return `rgba(34, 197, 94, ${Math.min(score * 0.2, 0.8)})`;
        if (score < 0) return `rgba(239, 68, 68, ${Math.min(-score * 0.2, 0.8)})`;
        return "rgba(107, 114, 128, 0.2)";
    }
    return score > 0 ? "#22c55e" : score < 0 ? "#ef4444" : "#6b7280";
};

interface TopicCardProps {
    topic: AIDigestResult;
    index?: number;
    interestScore?: number;
    favoriteTopics?: Record<string, boolean>;
    readTopics?: Record<string, boolean>;
    onToggleFavorite?: (topicId: string) => void;
    onMarkAsRead?: (topicId: string) => void;
}

const TopicCard: React.FC<TopicCardProps> = ({
    topic,
    index = 0,
    interestScore,
    favoriteTopics = {},
    readTopics = {},
    onToggleFavorite,
    onMarkAsRead
}) => {
    const [isFavorite, setIsFavorite] = useState(favoriteTopics[topic.topicId] || false);
    const [isRead, setIsRead] = useState(readTopics[topic.topicId] || false);

    useEffect(() => {
        setIsFavorite(favoriteTopics[topic.topicId] || false);
        setIsRead(readTopics[topic.topicId] || false);
    }, [favoriteTopics, readTopics, topic.topicId]);

    const contributorsArray = topic.contributors.split(",");

    const handleCopyTopic = () => {
        const contentToCopy = `话题: ${topic.topic}\n\n参与者: ${contributorsArray.join(", ")}\n\n详情: ${topic.detail}\n\n时间: ${new Date().toLocaleString()}\n话题ID: ${topic.topicId}\n会话ID: ${topic.sessionId}`;

        navigator.clipboard
            .writeText(contentToCopy)
            .then(() => {
                Notification.success({
                    title: "复制成功",
                    description: "话题内容已复制到剪贴板"
                });
            })
            .catch(err => {
                console.error("复制失败:", err);
                Notification.error({
                    title: "复制失败",
                    description: "无法复制话题内容"
                });
            });
    };

    const handleToggleFavorite = async () => {
        try {
            if (isFavorite) {
                await removeTopicFromFavorites(topic.topicId);
                setIsFavorite(false);
            } else {
                await markTopicAsFavorite(topic.topicId);
                setIsFavorite(true);
            }
            
            if (onToggleFavorite) {
                onToggleFavorite(topic.topicId);
            }
            
            Notification.success({
                title: isFavorite ? "已取消收藏" : "已添加收藏",
                description: isFavorite ? "话题已从收藏中移除" : "话题已添加到收藏"
            });
        } catch (error) {
            console.error("收藏操作失败:", error);
            Notification.error({
                title: "操作失败",
                description: "无法更新收藏状态"
            });
        }
    };

    const handleMarkAsRead = async () => {
        try {
            await markTopicAsRead(topic.topicId);
            setIsRead(true);
            
            if (onMarkAsRead) {
                onMarkAsRead(topic.topicId);
            }
            
            Notification.success({
                title: "标记成功",
                description: "话题已标记为已读"
            });
        } catch (error) {
            console.error("标记已读失败:", error);
            Notification.error({
                title: "操作失败",
                description: "无法标记话题为已读"
            });
        }
    };

    return (
        <Card className="border border-default-200">
            <CardHeader className="flex flex-col gap-2 relative">
                {/* 顺序号 */}
                {index !== undefined && (
                    <Chip className="absolute top-3.5 left-4" size="sm" variant="flat">
                        #{index + 1}
                    </Chip>
                )}
                
                {/* 兴趣指数 */}
                {interestScore !== undefined && (
                    <Chip
                        className="absolute top-3.5 right-4"
                        color={interestScore > 0 ? "success" : interestScore < 0 ? "danger" : "default"}
                        size="sm"
                        style={{
                            backgroundColor: generateColorFromInterestScore(interestScore, false),
                            color: "white"
                        }}
                        variant="flat"
                    >
                        {interestScore.toFixed(2)}
                    </Chip>
                )}
                
                <div className="flex justify-between items-start">
                    {/* 正文部分 */}
                    <h3 className="text-lg font-bold max-w-60 word-break break-all">{topic.topic}</h3>
                    <HeroUIButton
                        isIconOnly
                        size="sm"
                        variant="light"
                        onPress={handleCopyTopic}
                    >
                        <Copy size={16} />
                    </HeroUIButton>
                </div>
            </CardHeader>
            
            <CardBody className="relative pb-9">
                <EnhancedDetail contributors={contributorsArray} detail={topic.detail} />
                
                
                
                {/* 右下角的更多选项、收藏按钮和已读按钮 */}
                <div className="absolute bottom-3 right-3 flex gap-1">
                    <Dropdown>
                        <DropdownTrigger>
                            <HeroUIButton isIconOnly size="sm" variant="light">
                                <MoreVertical size={16} />
                            </HeroUIButton>
                        </DropdownTrigger>
                        <DropdownMenu aria-label="更多选项">
                            <DropdownItem key="participants" textValue="参与者">
                                <div className="flex flex-col gap-1">
                                    <p className="font-medium">参与者</p>
                                    <div className="flex flex-wrap gap-1">
                                        {contributorsArray.map((contributor, idx) => (
                                            <Chip
                                                key={idx}
                                                size="sm"
                                                style={{
                                                    backgroundColor: generateColorFromName(contributor),
                                                    color: generateColorFromName(contributor, false),
                                                    fontWeight: "bold"
                                                }}
                                                variant="flat"
                                            >
                                                {contributor}
                                            </Chip>
                                        ))}
                                    </div>
                                </div>
                            </DropdownItem>
                            <DropdownItem key="topicId" textValue="话题ID">
                                <div className="flex flex-col gap-1">
                                    <p className="font-medium">话题ID</p>
                                    <p className="text-sm">{topic.topicId}</p>
                                </div>
                            </DropdownItem>
                            <DropdownItem key="sessionId" textValue="会话ID">
                                <div className="flex flex-col gap-1">
                                    <p className="font-medium">会话ID</p>
                                    <p className="text-sm">{topic.sessionId}</p>
                                </div>
                            </DropdownItem>
                            
                        </DropdownMenu>
                    </Dropdown>
                    <HeroUIButton isIconOnly color="warning" size="sm" variant="flat" onPress={handleToggleFavorite}>
                        <Star fill={isFavorite ? "currentColor" : "none"} size={16} />
                    </HeroUIButton>
                    {!isRead && (
                        <HeroUIButton isIconOnly color="primary" size="sm" variant="flat" onPress={handleMarkAsRead}>
                            <Check size={16} />
                        </HeroUIButton>
                    )}
                </div>
            </CardBody>
        </Card>
    );
};

export default TopicCard;