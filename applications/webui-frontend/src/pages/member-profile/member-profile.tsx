import type { MemberProfile, MemberProfileContent } from "@/types/memberProfile";
import type { AIDigestResult } from "@/types/topic";

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/react";
import { Spinner } from "@heroui/spinner";
import { UserCircle, Search, RefreshCw, AlertCircle } from "lucide-react";

import QQAvatar from "@/components/QQAvatar";
import DefaultLayout from "@/layouts/default";
import { title } from "@/components/primitives";
import { Notification } from "@/util/Notification";
import { formatRelativeTime } from "@/util/format";
import { isLikelyQQId } from "@/util/isLikelyQQId";
import { getMemberProfile, getContributorTopics, generateMemberProfile } from "@/api/memberProfileApi";

import ProfileCard from "./components/ProfileCard";
import ContributorTopicList from "./components/ContributorTopicList";

/**
 * 解析画像 JSON 为 MemberProfileContent，解析失败返回 null
 */
function parseProfileContent(profileJson: string): MemberProfileContent | null {
    try {
        const parsed = JSON.parse(profileJson) as MemberProfileContent;

        if (parsed && typeof parsed === "object") {
            return parsed;
        }

        return null;
    } catch {
        return null;
    }
}

export default function MemberProfilePage() {
    const navigate = useNavigate();
    const { qqId: routeQqId } = useParams<{ qqId?: string }>();
    const [searchParams] = useSearchParams();

    // URL 中的昵称（点击头像跳转时携带）
    const nicknameFromUrl = searchParams.get("nickname") ?? undefined;

    // 当前查询的 QQ号（来自路由）
    const qqId = routeQqId ?? "";

    // 画像相关状态
    const [profile, setProfile] = useState<MemberProfile | null>(null);
    const [loading, setLoading] = useState<boolean>(false); // 查缓存或生成中 loading
    const [error, setError] = useState<string>("");

    // 依据话题
    const [topics, setTopics] = useState<AIDigestResult[]>([]);
    const [topicsLoading, setTopicsLoading] = useState<boolean>(false);

    // 导航栏进入时的输入框
    const [inputQqId, setInputQqId] = useState<string>("");

    // 画像生成（非流式）
    const handleGenerate = useCallback(async (senderId: string, nickname?: string) => {
        if (!senderId) {
            return;
        }

        setLoading(true);
        setError("");
        setProfile(null);

        try {
            const response = await generateMemberProfile({ senderId, nickname });

            if (response.success && response.data) {
                setProfile(response.data);
            } else {
                setError(response.message || "画像生成失败");
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, []);

    // 查缓存 + 未命中自动生成
    useEffect(() => {
        if (!qqId) {
            return;
        }

        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setError("");
            setProfile(null);
            setTopics([]);

            try {
                const response = await getMemberProfile(qqId);

                if (cancelled) {
                    return;
                }

                if (response.success && response.data) {
                    setProfile(response.data);
                    setLoading(false);

                    return;
                }

                // 未命中缓存：自动触发生成
                setLoading(false);
                void handleGenerate(qqId, nicknameFromUrl);
            } catch (e) {
                if (cancelled) {
                    return;
                }
                const msg = e instanceof Error ? e.message : String(e);
                setError(msg);
                setLoading(false);
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
        // qqId 变化时重新加载；nicknameFromUrl 仅首生成时使用，不作为重载依赖
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [qqId]);

    // 拉取依据话题（画像就绪或生成结束后）
    useEffect(() => {
        if (!qqId || loading) {
            return;
        }

        let cancelled = false;
        setTopicsLoading(true);

        getContributorTopics(qqId)
            .then(response => {
                if (cancelled) {
                    return;
                }
                if (response.success) {
                    setTopics(response.data);
                } else {
                    setTopics([]);
                }
            })
            .catch(e => {
                console.error("拉取依据话题失败:", e);
                if (!cancelled) {
                    setTopics([]);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setTopicsLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [qqId, loading]);

    const handleRegenerate = () => {
        if (!qqId) {
            return;
        }
        void handleGenerate(qqId, nicknameFromUrl ?? profile?.nickname ?? undefined);
    };

    const handleQueryByInput = () => {
        const trimmed = inputQqId.trim();
        if (!trimmed) {
            Notification.error({ title: "请输入QQ号", description: "QQ号不能为空" });
            return;
        }
        if (!isLikelyQQId(trimmed)) {
            Notification.error({ title: "QQ号格式不正确", description: "QQ号应为纯数字" });
            return;
        }
        navigate(`/member-profile/${trimmed}`);
    };

    const profileContent = profile ? parseProfileContent(profile.profileJson) : null;

    // 无路由 qqId：导航栏入口，展示输入框
    if (!qqId) {
        return (
            <DefaultLayout>
                <section className="flex flex-col items-center gap-6 py-0 md:py-10">
                    <div className="hidden sm:flex flex-col items-center justify-center gap-4">
                        <h1 className={title()}>群友个人画像</h1>
                        <p className="text-default-600 max-w-2xl text-center">输入群友的 QQ号，基于其参与的话题聚合生成结构化画像总结</p>
                    </div>
                    <Card className="w-full max-w-md">
                        <CardHeader className="flex items-center gap-2">
                            <UserCircle size={20} />
                            <h2 className="text-lg font-bold">输入 QQ号</h2>
                        </CardHeader>
                        <CardBody>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Input
                                    aria-label="QQ号输入框"
                                    className="flex-1"
                                    placeholder="请输入群友的 QQ号"
                                    value={inputQqId}
                                    onValueChange={setInputQqId}
                                    onKeyDown={e => {
                                        if (e.key === "Enter") {
                                            handleQueryByInput();
                                        }
                                    }}
                                />
                                <Button color="primary" startContent={<Search size={16} />} onPress={handleQueryByInput}>
                                    查询
                                </Button>
                            </div>
                        </CardBody>
                    </Card>
                </section>
            </DefaultLayout>
        );
    }

    return (
        <DefaultLayout>
            <section className="flex flex-col gap-4 py-0 md:py-10">
                {/* 头部：头像 + 昵称 + QQ号 */}
                <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-3">
                        {isLikelyQQId(qqId) && <QQAvatar qqId={qqId} sizeClassName="w-12 h-12" type="user" />}
                        <div className="flex flex-col">
                            <span className="text-xl font-bold">{nicknameFromUrl ?? profile?.nickname ?? qqId}</span>
                            <span className="text-default-500 text-sm">QQ号：{qqId}</span>
                        </div>
                    </div>
                    <h1 className={title()}>群友个人画像</h1>
                </div>

                {/* 生成中 */}
                {loading && (
                    <Card className="border border-primary-200">
                        <CardBody className="flex flex-col items-center gap-3 py-10">
                            <Spinner size="lg" />
                            <p className="text-default-600">正在生成画像，请稍候…</p>
                        </CardBody>
                    </Card>
                )}

                {/* 错误 */}
                {!loading && error && (
                    <Card className="border border-danger-200">
                        <CardBody className="flex flex-col items-center gap-3 py-8">
                            <AlertCircle className="text-danger" size={36} />
                            <p className="text-danger font-medium">画像生成失败</p>
                            <p className="text-default-500 text-sm text-center max-w-xl break-all">{error}</p>
                            <Button color="primary" startContent={<RefreshCw size={16} />} variant="flat" onPress={handleRegenerate}>
                                重新生成
                            </Button>
                        </CardBody>
                    </Card>
                )}

                {/* 画像卡片 */}
                {!loading && !error && profileContent && (
                    <div className="flex flex-col gap-3">
                        <ProfileCard content={profileContent} modelName={profile?.modelName} topicCount={profile?.topicCount} />
                        <div className="flex justify-end">
                            <Button color="primary" startContent={<RefreshCw size={16} />} variant="flat" onPress={handleRegenerate}>
                                重新生成
                            </Button>
                        </div>
                    </div>
                )}

                {/* 缓存命中但画像内容解析失败 */}
                {!loading && !error && profile && !profileContent && (
                    <Card className="border border-warning-200">
                        <CardBody className="flex flex-col items-center gap-3 py-8">
                            <AlertCircle className="text-warning" size={36} />
                            <p className="text-default-600">缓存的画像数据格式异常，请重新生成</p>
                            <Button color="primary" startContent={<RefreshCw size={16} />} variant="flat" onPress={handleRegenerate}>
                                重新生成
                            </Button>
                        </CardBody>
                    </Card>
                )}

                {/* 依据话题列表（画像就绪或错误后均可展示） */}
                {!loading && <ContributorTopicList loading={topicsLoading} topics={topics} />}

                {/* 画像元信息 */}
                {profile && !loading && (
                    <div className="flex justify-center">
                        <Chip size="sm" variant="flat">
                            生成模型：{profile.modelName} · 更新于 {formatRelativeTime(profile.updatedAt)}
                        </Chip>
                    </div>
                )}
            </section>
        </DefaultLayout>
    );
}
