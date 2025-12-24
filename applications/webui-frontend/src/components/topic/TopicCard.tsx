import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Tooltip } from "@heroui/react";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { Button as HeroUIButton } from "@heroui/button";
import { MoreVertical, Check, Copy, Star } from "lucide-react";

import { generateColorFromName, generateColorFromInterestScore, parseContributors } from "./utils";
import EnhancedDetail from "./EnhancedDetail";

import { AIDigestResult } from "@/types/app";
import { Notification } from "@/util/Notification";

// TopicItem 类型（来自 latest-topics）
interface TopicItemData {
    topicId: string;
    sessionId: string;
    topic: string;
    contributors: string;
    detail: string;
    timeStart: number;
    timeEnd: number;
    groupId: string;
}

// TopicCard 可接受的数据类型
type TopicData = TopicItemData | AIDigestResult;

// 类型守卫：判断是否为 TopicItemData
function isTopicItemData(topic: TopicData): topic is TopicItemData {
    return "timeStart" in topic && "timeEnd" in topic && "groupId" in topic;
}

interface TopicCardProps {
    topic: TopicData;
    index?: number; // 可选的序号，用于显示 #1, #2 等
    interestScore?: number;
    favoriteTopics?: Record<string, boolean>;
    readTopics?: Record<string, boolean>;
    onToggleFavorite?: (topicId: string) => void;
    onMarkAsRead?: (topicId: string) => void;
}

const TopicCard: React.FC<TopicCardProps> = ({
    topic,
    index,
    interestScore,
    favoriteTopics = {},
    readTopics = {},
    onToggleFavorite,
    onMarkAsRead
}) => {
    // 解析参与者
    const contributorsArray = parseContributors(topic.contributors);

    // 判断是否包含扩展字段
    const hasTimeAndGroup = isTopicItemData(topic);

    // 复制话题内容到剪贴板
    const handleCopy = () => {
        let contentToCopy = `话题: ${topic.topic}\n\n参与者: ${contributorsArray.join(", ")}\n\n详情: ${topic.detail}`;

        // 如果有时间和群信息，则添加
        if (hasTimeAndGroup) {
            contentToCopy += `\n\n时间: ${new Date(topic.timeStart).toLocaleString()} - ${new Date(topic.timeEnd).toLocaleString()}\n群ID: ${topic.groupId}`;
        }

        contentToCopy += `\n话题ID: ${topic.topicId}\n会话ID: ${topic.sessionId}`;

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

    return (
        <Card className="border border-default-200">
            <CardHeader className="flex flex-col gap-2 relative">
                {/* 序号（可选） */}
                {index !== undefined && (
                    <Chip className="absolute top-3.5 left-4" size="sm" variant="flat">
                        #{index}
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
                    {/* 话题标题 */}
                    <h3 className="text-lg font-bold max-w-60 word-break break-all">{topic.topic}</h3>
                    <Tooltip color="default" content="复制话题内容" placement="top">
                        <HeroUIButton isIconOnly size="sm" variant="light" onPress={handleCopy}>
                            <Copy size={16} />
                        </HeroUIButton>
                    </Tooltip>
                </div>
                {/* 时间范围（仅当有时间信息时显示） */}
                {hasTimeAndGroup && (
                    <div className="text-default-500 text-sm">
                        <Chip className="mr-1" size="sm" variant="flat">
                            🕗
                            {new Date(topic.timeStart).toLocaleDateString("zh-CN", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                            })}
                        </Chip>
                        ➡️
                        <Chip className="ml-1" size="sm" variant="flat">
                            🕗
                            {new Date(topic.timeEnd).toLocaleDateString("zh-CN", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                            })}
                        </Chip>
                    </div>
                )}
            </CardHeader>
            <CardBody className="relative pb-9">
                <EnhancedDetail contributors={contributorsArray} detail={topic.detail} />
                {/* 群ID和群头像（仅当有群信息时显示） */}
                {hasTimeAndGroup && (
                    <div className="absolute bottom-3 left-3 flex items-center gap-2">
                        <img
                            alt="群头像"
                            className="w-6 h-6 rounded-full"
                            src={`http://p.qlogo.cn/gh/${topic.groupId}/${topic.groupId}/0`}
                            onError={e => {
                                const target = e.target as HTMLImageElement;

                                target.onerror = null;
                                target.src =
                                    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ccc'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
                            }}
                        />
                        <Chip size="sm" variant="flat">
                            群ID: {topic.groupId}
                        </Chip>
                    </div>
                )}
                {/* 右下角的更多选项、收藏按钮和已读按钮 */}
                <div className="absolute bottom-3 right-3 flex gap-1">
                    <Dropdown>
                        <DropdownTrigger>
                            <HeroUIButton isIconOnly size="sm" variant="light">
                                <MoreVertical size={16} />
                            </HeroUIButton>
                        </DropdownTrigger>
                        <DropdownMenu aria-label="更多选项" items={[
                            { key: "participants", label: "参与者" },
                            { key: "topicId", label: "话题ID" },
                            { key: "sessionId", label: "会话ID" },
                            ...(hasTimeAndGroup ? [{ key: "groupId", label: "群ID" }] : [])
                        ]}>
                            {(item) => {
                                if (item.key === "participants") {
                                    return (
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
                                    );
                                }
                                if (item.key === "topicId") {
                                    return (
                                        <DropdownItem key="topicId" textValue="话题ID">
                                            <div className="flex flex-col gap-1">
                                                <p className="font-medium">话题ID</p>
                                                <p className="text-sm">{topic.topicId}</p>
                                            </div>
                                        </DropdownItem>
                                    );
                                }
                                if (item.key === "sessionId") {
                                    return (
                                        <DropdownItem key="sessionId" textValue="会话ID">
                                            <div className="flex flex-col gap-1">
                                                <p className="font-medium">会话ID</p>
                                                <p className="text-sm">{topic.sessionId}</p>
                                            </div>
                                        </DropdownItem>
                                    );
                                }
                                if (item.key === "groupId" && hasTimeAndGroup) {
                                    return (
                                        <DropdownItem key="groupId" textValue="群ID">
                                            <div className="flex flex-col gap-1">
                                                <p className="font-medium">群ID</p>
                                                <p className="text-sm">{topic.groupId}</p>
                                            </div>
                                        </DropdownItem>
                                    );
                                }
                                return null as unknown as React.ReactElement;
                            }}
                        </DropdownMenu>
                    </Dropdown>
                    {onToggleFavorite && (
                        <Tooltip color="warning" content={favoriteTopics[topic.topicId] ? "取消收藏" : "添加收藏"} placement="top">
                            <HeroUIButton isIconOnly color="warning" size="sm" variant="flat" onPress={() => onToggleFavorite(topic.topicId)}>
                                <Star fill={favoriteTopics[topic.topicId] ? "currentColor" : "none"} size={16} />
                            </HeroUIButton>
                        </Tooltip>
                    )}
                    {onMarkAsRead && !readTopics[topic.topicId] && (
                        <Tooltip color="primary" content="标记为已读" placement="top">
                            <HeroUIButton isIconOnly color="primary" size="sm" variant="flat" onPress={() => onMarkAsRead(topic.topicId)}>
                                <Check size={16} />
                            </HeroUIButton>
                        </Tooltip>
                    )}
                </div>
            </CardBody>
        </Card>
    );
};

export default TopicCard;
export type { TopicData, TopicItemData };
