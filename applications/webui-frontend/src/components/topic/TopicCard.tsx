import type React from "react";

import { useRef } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Tooltip } from "@heroui/react";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { Button as HeroUIButton } from "@heroui/button";
import { MoreVertical, Check, Copy, Star, Download } from "lucide-react";
import domtoimage from "dom-to-image";

import { generateColorFromName, generateColorFromInterestScore, parseContributors } from "./utils";
import EnhancedDetail from "./EnhancedDetail";

import QQAvatar from "@/components/QQAvatar";
import { AIDigestResult } from "@/types/app";
import { Notification } from "@/util/Notification";
import { formatRelativeTime } from "@/util/format";

// TopicItem 类型（来自 latest-topics）
interface TopicItemData {
    topicId: string;
    sessionId: string;
    topic: string;
    contributors: string;
    detail: string;
    modelName: string;
    updateTime: number;
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

const TopicCard: React.FC<TopicCardProps> = ({ topic, index, interestScore, favoriteTopics = {}, readTopics = {}, onToggleFavorite, onMarkAsRead }) => {
    const cardCaptureRef = useRef<HTMLDivElement>(null);

    // 解析参与者
    const contributorsArray = parseContributors(topic.contributors);

    // 判断是否包含扩展字段
    const hasTimeAndGroup = isTopicItemData(topic);
    const hasTime = "timeStart" in topic && "timeEnd" in topic;
    const hasGroup = "groupId" in topic;

    // 复制话题内容到剪贴板
    const handleCopy = () => {
        let contentToCopy = `话题: ${topic.topic}\n\n参与者: ${contributorsArray.join(", ")}\n\n模型: ${topic.modelName}\n更新时间: ${new Date(topic.updateTime).toLocaleString("zh-CN")}\n\n详情: ${topic.detail}`;

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

    const handleCopyField = (fieldLabel: string, text: string) => {
        navigator.clipboard
            .writeText(text)
            .then(() => {
                Notification.success({
                    title: "复制成功",
                    description: `${fieldLabel} 已复制`
                });
            })
            .catch(err => {
                console.error(`复制 ${fieldLabel} 失败:`, err);
                Notification.error({
                    title: "复制失败",
                    description: `${fieldLabel} 无法复制`
                });
            });
    };

    const CopyIconButton: React.FC<{ label: string; text: string }> = ({ label, text }) => (
        <HeroUIButton isIconOnly aria-label={`复制${label}`} className="shrink-0" size="sm" variant="light" onPress={() => handleCopyField(label, text)}>
            <Copy size={16} />
        </HeroUIButton>
    );

    const handleSaveAsImage = async () => {
        if (!cardCaptureRef.current) {
            return;
        }

        const node = cardCaptureRef.current;

        const safeTopic = (topic.topic || "topic")
            .replace(/[\\/:*?"<>|]/g, "_")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 24);

        try {
            const dataUrl = await domtoimage.toPng(node, {
                quality: 1.0,
                bgcolor: "transparent"
            });

            const link = document.createElement("a");

            link.download = `话题_${safeTopic}_${new Date().getTime()}.png`;
            link.href = dataUrl;
            link.click();

            Notification.success({
                title: "保存成功",
                description: "话题卡片已保存为图片"
            });
        } catch (error) {
            console.error("保存图片失败:", error);
            Notification.error({
                title: "保存失败",
                description: "无法保存为图片（可能有跨域图片资源）。错误信息：" + JSON.stringify(error)
            });
        }
    };

    return (
        <div ref={cardCaptureRef}>
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
                    {hasTime && (
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
                            <Tooltip content={new Date(topic.updateTime).toLocaleString("zh-CN")} placement="top">
                                <Chip className="ml-2" size="sm" variant="flat">
                                    {formatRelativeTime(topic.updateTime)}
                                </Chip>
                            </Tooltip>
                        </div>
                    )}
                </CardHeader>
                <CardBody className="relative pb-9 overflow-hidden">
                    <EnhancedDetail contributors={contributorsArray} detail={topic.detail} />
                    {/* 群ID和群头像（仅当有群信息时显示） */}
                    <div className="absolute bottom-3 left-3 flex items-center gap-2">
                        {hasGroup && (
                            <>
                                <QQAvatar qqId={topic.groupId} type="group" />
                                <Chip size="sm" variant="flat">
                                    {topic.groupId}
                                </Chip>
                            </>
                        )}
                        <Chip className="" size="sm" variant="flat">
                            {topic.modelName}
                        </Chip>
                    </div>

                    {/* 右下角的更多选项、收藏按钮和已读按钮 */}
                    <div className="absolute bottom-3 right-3 flex gap-1">
                        <Dropdown>
                            <DropdownTrigger>
                                <HeroUIButton isIconOnly size="sm" variant="light">
                                    <MoreVertical size={16} />
                                </HeroUIButton>
                            </DropdownTrigger>
                            <DropdownMenu
                                aria-label="更多选项"
                                className="max-w-[300px]"
                                items={[
                                    { key: "saveAsImage", label: "保存为图片" },
                                    { key: "participants", label: "参与者" },
                                    { key: "topicId", label: "话题ID" },
                                    { key: "sessionId", label: "会话ID" },
                                    { key: "modelName", label: "模型" },
                                    { key: "updateTime", label: "更新时间" },
                                    ...(hasGroup ? [{ key: "groupId", label: "群ID" }] : [])
                                ]}
                            >
                                {item => {
                                    if (item.key === "saveAsImage") {
                                        return (
                                            <DropdownItem key="saveAsImage" textValue="保存为图片" onPress={handleSaveAsImage}>
                                                <div className="flex w-full items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <Download className="h-4 w-4 text-default-500" />
                                                        <p className="font-medium">保存为图片</p>
                                                    </div>
                                                </div>
                                            </DropdownItem>
                                        );
                                    }
                                    if (item.key === "participants") {
                                        const participantsText = contributorsArray.join(", ");

                                        return (
                                            <DropdownItem key="participants" textValue="参与者">
                                                <div className="flex w-full items-start justify-between gap-2">
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
                                                    <CopyIconButton label="参与者" text={participantsText} />
                                                </div>
                                            </DropdownItem>
                                        );
                                    }
                                    if (item.key === "topicId") {
                                        return (
                                            <DropdownItem key="topicId" textValue="话题ID">
                                                <div className="flex w-full items-start justify-between gap-2">
                                                    <div className="flex flex-col gap-1">
                                                        <p className="font-medium">话题ID</p>
                                                        <p className="text-sm">{topic.topicId}</p>
                                                    </div>
                                                    <CopyIconButton label="话题ID" text={topic.topicId} />
                                                </div>
                                            </DropdownItem>
                                        );
                                    }
                                    if (item.key === "sessionId") {
                                        return (
                                            <DropdownItem key="sessionId" textValue="会话ID">
                                                <div className="flex w-full items-start justify-between gap-2">
                                                    <div className="flex flex-col gap-1">
                                                        <p className="font-medium">会话ID</p>
                                                        <p className="text-sm">{topic.sessionId}</p>
                                                    </div>
                                                    <CopyIconButton label="会话ID" text={topic.sessionId} />
                                                </div>
                                            </DropdownItem>
                                        );
                                    }
                                    if (item.key === "modelName") {
                                        return (
                                            <DropdownItem key="modelName" textValue="模型">
                                                <div className="flex w-full items-start justify-between gap-2">
                                                    <div className="flex flex-col gap-1">
                                                        <p className="font-medium">模型</p>
                                                        <p className="text-sm">{topic.modelName}</p>
                                                    </div>
                                                    <CopyIconButton label="模型" text={topic.modelName} />
                                                </div>
                                            </DropdownItem>
                                        );
                                    }
                                    if (item.key === "updateTime") {
                                        const updateTimeText = new Date(topic.updateTime).toLocaleString("zh-CN");

                                        return (
                                            <DropdownItem key="updateTime" textValue="更新时间">
                                                <div className="flex w-full items-start justify-between gap-2">
                                                    <div className="flex flex-col gap-1">
                                                        <p className="font-medium">更新时间</p>
                                                        <p className="text-sm">{updateTimeText}</p>
                                                    </div>
                                                    <CopyIconButton label="更新时间" text={updateTimeText} />
                                                </div>
                                            </DropdownItem>
                                        );
                                    }
                                    if (item.key === "groupId" && hasGroup) {
                                        return (
                                            <DropdownItem key="groupId" textValue="群ID">
                                                <div className="flex w-full items-start justify-between gap-2">
                                                    <div className="flex flex-col gap-1">
                                                        <p className="font-medium">群ID</p>
                                                        <p className="text-sm">{topic.groupId}</p>
                                                    </div>
                                                    <CopyIconButton label="群ID" text={topic.groupId} />
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
        </div>
    );
};

export default TopicCard;
export type { TopicData, TopicItemData };
