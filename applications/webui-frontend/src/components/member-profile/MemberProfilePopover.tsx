import type { MemberProfile } from "@/types/memberProfile";

import React, { cloneElement, isValidElement, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import { Spinner } from "@heroui/spinner";
import { AlertCircle, RefreshCw, ExternalLink } from "lucide-react";

import QQAvatar from "@/components/QQAvatar";
import { formatRelativeTime } from "@/util/format";
import { parseProfileContent } from "@/util/parseProfileContent";
import { getMemberProfile, generateMemberProfile } from "@/api/memberProfileApi";

import ProfileFieldsList from "./ProfileFieldsList";

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

interface MemberProfilePopoverProps {
    /** 群友 QQ号 */
    qqId: string;
    /** 群友昵称（仅展示，未提供则用画像记录中的 nickname 或 qqId） */
    nickname?: string;
    /** 触发元素（contributor chip） */
    children: React.ReactNode;
}

const EMPTY_CONTENT = {
    school: null,
    company: null,
    domain: null,
    experience: null,
    interests: null,
    communicationStyle: null
};

/**
 * 群友画像 Popover
 * 点击 contributor chip 弹出，懒加载画像：先查缓存，未命中自动触发生成（非流式）
 * 仿 TopicPopover 结构：受控 isOpen + onOpenChange、hasLoaded 闸门、移动端 Drawer 兜底
 */
const MemberProfilePopover: React.FC<MemberProfilePopoverProps> = ({ children, nickname, qqId }) => {
    const navigate = useNavigate();
    const [profile, setProfile] = useState<MemberProfile | null>(null);
    const [isLoading, setIsLoading] = useState(false); // 查缓存中
    const [isGenerating, setIsGenerating] = useState(false); // 生成中
    const [isOpen, setIsOpen] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [error, setError] = useState("");
    const isMobile = useMediaQuery("(max-width: 767px)");

    const generateProfile = useCallback(async () => {
        setIsGenerating(true);
        setError("");

        try {
            const response = await generateMemberProfile({ senderId: qqId, nickname });

            if (response.success && response.data) {
                setProfile(response.data);
                setHasLoaded(true);
            } else {
                setError(response.message || "画像生成失败");
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);

            setError(`画像生成失败: ${msg}`);
        } finally {
            setIsGenerating(false);
        }
    }, [nickname, qqId]);

    const loadProfile = useCallback(async () => {
        if (hasLoaded || isLoading || isGenerating) {
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            const response = await getMemberProfile(qqId);

            if (response.success && response.data) {
                // 缓存命中
                setProfile(response.data);
                setHasLoaded(true);
            } else {
                // 未命中：自动触发生成
                await generateProfile();
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);

            setError(`画像加载失败: ${msg}`);
        } finally {
            setIsLoading(false);
        }
    }, [generateProfile, hasLoaded, isGenerating, isLoading, qqId]);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);

        if (open && !hasLoaded && !isLoading && !isGenerating) {
            void loadProfile();
        }
    };

    const open = useCallback(() => {
        setIsOpen(true);

        if (!hasLoaded && !isLoading && !isGenerating) {
            void loadProfile();
        }
    }, [hasLoaded, isLoading, isGenerating, loadProfile]);

    const handleRetry = () => {
        void generateProfile();
    };

    const handleGotoFullPage = () => {
        setIsOpen(false);
        navigate(`/member-profile/${qqId}?nickname=${encodeURIComponent(nickname ?? "")}`);
    };

    const displayNickname = nickname ?? profile?.nickname ?? qqId;
    const profileContent = profile ? parseProfileContent(profile.profileJson) : null;

    const content = (
        <div className="flex flex-col gap-3 p-1">
            {(isLoading || isGenerating) && (
                <div className="flex flex-col items-center gap-3 py-10">
                    <Spinner label={isGenerating ? "正在生成画像，请稍候…" : "加载画像中…"} size="lg" />
                    <p className="text-default-500 text-xs">依据该群友参与的话题聚合生成，可能需要一些时间</p>
                </div>
            )}

            {!isLoading && !isGenerating && error && (
                <div className="flex flex-col items-center gap-3 py-6">
                    <AlertCircle className="text-danger" size={32} />
                    <p className="text-danger text-sm text-center break-all">{error}</p>
                    <div className="flex gap-2">
                        <Button color="primary" size="sm" startContent={<RefreshCw size={14} />} variant="flat" onPress={handleRetry}>
                            重试
                        </Button>
                        <Button size="sm" startContent={<ExternalLink size={14} />} variant="light" onPress={handleGotoFullPage}>
                            前往画像页
                        </Button>
                    </div>
                </div>
            )}

            {!isLoading && !isGenerating && !error && profile && (
                <>
                    {/* 头部：头像 + 昵称 + QQ号 */}
                    <div className="flex items-center gap-3">
                        <QQAvatar qqId={qqId} sizeClassName="w-10 h-10" type="user" />
                        <div className="flex flex-col min-w-0">
                            <span className="text-base font-bold truncate">{displayNickname}</span>
                            <span className="text-default-500 text-xs">QQ号：{qqId}</span>
                        </div>
                    </div>

                    {/* 六字段紧凑列表 */}
                    <ProfileFieldsList content={profileContent ?? EMPTY_CONTENT} />

                    {/* 底部：模型名 + 更新时间 */}
                    <div className="flex flex-wrap items-center gap-2">
                        <Chip size="sm" variant="flat">
                            {profile.modelName}
                        </Chip>
                        <span className="text-default-400 text-xs">更新于 {formatRelativeTime(profile.updatedAt)}</span>
                    </div>

                    {/* 跳转完整画像页 */}
                    <Button className="w-full" color="primary" size="sm" startContent={<ExternalLink size={14} />} variant="flat" onPress={handleGotoFullPage}>
                        查看完整画像
                    </Button>
                </>
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
                                <DrawerHeader className="flex flex-col gap-1">群友画像</DrawerHeader>
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
            <PopoverContent className="w-[400px] max-h-[80vh] overflow-y-auto">{content}</PopoverContent>
        </Popover>
    );
};

export default MemberProfilePopover;
