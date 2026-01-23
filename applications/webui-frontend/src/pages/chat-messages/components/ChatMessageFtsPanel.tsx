import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { Pagination } from "@heroui/pagination";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Spinner } from "@heroui/spinner";
import { Switch } from "@heroui/switch";
import { Search } from "lucide-react";

import { chatMessagesFtsSearch, getChatMessagesFtsContext } from "@/api/basicApi";
import QQAvatar from "@/components/QQAvatar";
import { highlightTextByTokens } from "@/util/highlightText";

type FtsHit = { msgId: string; timestamp: number; snippet: string };
type FtsGroup = { groupId: string; count: number; hits: FtsHit[] };
type FtsResult = { total: number; page: number; pageSize: number; groups: FtsGroup[] };

type ChatMessage = {
    msgId: string;
    messageContent: string;
    groupId: string;
    timestamp: number;
    senderId: string;
    senderGroupNickname: string;
    senderNickname: string;
    quotedMsgId: string;
    sessionId: string;
    preProcessedContent: string;
};

export function ChatMessageFtsPanel(props: { selectedGroupId: string; startTimeMs: number; endTimeMs: number; groupNameResolver?: (groupId: string) => string | undefined }) {
    const [query, setQuery] = useState<string>("");
    const [page, setPage] = useState<number>(1);
    const [pageSize] = useState<number>(20);

    const [useCurrentGroupOnly, setUseCurrentGroupOnly] = useState<boolean>(false);
    const [useTimeFilter, setUseTimeFilter] = useState<boolean>(false);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [result, setResult] = useState<FtsResult | null>(null);

    const [selectedHit, setSelectedHit] = useState<{ groupId: string; msgId: string } | null>(null);
    const [isContextLoading, setIsContextLoading] = useState<boolean>(false);
    const [contextMessages, setContextMessages] = useState<ChatMessage[] | null>(null);

    const canSearch = useMemo(() => query.trim().length > 0, [query]);

    const isLikelyQQId = useCallback((value: string): boolean => {
        if (!value) {
            return false;
        }

        const trimmed = value.trim();

        if (trimmed.length === 0) {
            return false;
        }

        for (let i = 0; i < trimmed.length; i++) {
            const code = trimmed.charCodeAt(i);

            if (code < 48 || code > 57) {
                return false;
            }
        }

        return true;
    }, []);

    const runSearch = useCallback(
        async (nextPage: number) => {
            if (!canSearch) return;

            setIsLoading(true);
            try {
                const response = await chatMessagesFtsSearch({
                    query,
                    groupIds: useCurrentGroupOnly && props.selectedGroupId ? [props.selectedGroupId] : undefined,
                    timeStart: useTimeFilter ? props.startTimeMs : undefined,
                    timeEnd: useTimeFilter ? props.endTimeMs : undefined,
                    page: nextPage,
                    pageSize
                });

                if (response.success) {
                    setResult(response.data);
                } else {
                    setResult(null);
                }
            } finally {
                setIsLoading(false);
            }
        },
        [canSearch, pageSize, props.endTimeMs, props.selectedGroupId, props.startTimeMs, query, useCurrentGroupOnly, useTimeFilter]
    );

    useEffect(() => {
        if (page !== 1) {
            setPage(1);
        }
    }, [query, useCurrentGroupOnly, useTimeFilter]);

    useEffect(() => {
        if (!canSearch) {
            setResult(null);
        }
    }, [canSearch]);

    const fetchContext = useCallback(async (groupId: string, msgId: string) => {
        setSelectedHit({ groupId, msgId });
        setIsContextLoading(true);
        setContextMessages(null);
        try {
            const resp = await getChatMessagesFtsContext({ groupId, msgId, before: 20, after: 20 });

            if (resp.success) {
                setContextMessages(resp.data);
            } else {
                setContextMessages([]);
            }
        } finally {
            setIsContextLoading(false);
        }
    }, []);

    const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

    return (
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader className="flex flex-col gap-3">
                    <div className="flex items-center justify-between w-full flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold">全文搜索（FTS）</h3>
                            {result && (
                                <Chip color="primary" size="sm" variant="flat">
                                    命中 {result.total}
                                </Chip>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch isSelected={useCurrentGroupOnly} size="sm" onValueChange={setUseCurrentGroupOnly}>
                                仅当前群
                            </Switch>
                            <Switch isSelected={useTimeFilter} size="sm" onValueChange={setUseTimeFilter}>
                                使用时间范围
                            </Switch>
                        </div>
                    </div>

                    <div className="flex gap-2 w-full flex-wrap">
                        <Input
                            isClearable
                            className="flex-1 min-w-[240px]"
                            placeholder="输入关键词（纯文本）..."
                            startContent={<Search className="text-default-400" size={16} />}
                            value={query}
                            onClear={() => setQuery("")}
                            onKeyDown={e => {
                                if (e.key === "Enter") {
                                    setPage(1);
                                    runSearch(1);
                                }
                            }}
                            onValueChange={setQuery}
                        />
                        <Button
                            color="primary"
                            isDisabled={!canSearch}
                            isLoading={isLoading}
                            onPress={() => {
                                setPage(1);
                                runSearch(1);
                            }}
                        >
                            搜索
                        </Button>
                    </div>
                </CardHeader>
                <CardBody>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-40">
                            <Spinner size="lg" />
                        </div>
                    ) : !result ? (
                        <div className="text-default-500 text-sm">输入关键词后点击搜索。</div>
                    ) : result.groups.length === 0 ? (
                        <div className="text-default-500 text-sm">未找到匹配结果。</div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <ScrollShadow className="max-h-[calc(100vh-520px)]">
                                <div className="flex flex-col gap-4 pr-2">
                                    {result.groups.map(group => (
                                        <div key={group.groupId} className="border border-default-200 rounded-lg p-3">
                                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                                <div className="font-semibold text-sm flex items-center gap-2">
                                                    {isLikelyQQId(group.groupId) && <QQAvatar qqId={group.groupId} type="group" />}
                                                    <span>
                                                        {group.groupId}
                                                        {props.groupNameResolver?.(group.groupId) ? ` - ${props.groupNameResolver(group.groupId)}` : ""}
                                                    </span>
                                                </div>
                                                <Chip size="sm" variant="flat">
                                                    {group.count} 条
                                                </Chip>
                                            </div>

                                            <div className="mt-2 flex flex-col gap-2">
                                                {group.hits.map(hit => (
                                                    <button
                                                        key={hit.msgId}
                                                        className="text-left w-full rounded-md p-2 hover:bg-default-100 transition"
                                                        onClick={() => fetchContext(group.groupId, hit.msgId)}
                                                    >
                                                        <div className="text-xs text-default-500">{new Date(hit.timestamp).toLocaleString("zh-CN")}</div>
                                                        <div className="text-sm text-default-800 break-words">{highlightTextByTokens(hit.snippet || "", query)}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollShadow>

                            {totalPages > 1 && (
                                <div className="flex w-full justify-center">
                                    <Pagination
                                        isCompact
                                        showControls
                                        showShadow
                                        color="primary"
                                        page={page}
                                        total={totalPages}
                                        onChange={p => {
                                            setPage(p);
                                            runSearch(p);
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </CardBody>
            </Card>

            {selectedHit && (
                <Card>
                    <CardHeader className="flex items-center justify-between">
                        <div className="text-sm font-semibold">上下文（{selectedHit.groupId}）</div>
                    </CardHeader>
                    <CardBody>
                        {isContextLoading ? (
                            <div className="flex justify-center items-center h-32">
                                <Spinner size="lg" />
                            </div>
                        ) : !contextMessages ? (
                            <div className="text-default-500 text-sm">点击某条命中结果以加载上下文。</div>
                        ) : contextMessages.length === 0 ? (
                            <div className="text-default-500 text-sm">未能加载上下文或消息不存在。</div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {contextMessages.map(m => (
                                    <div key={m.msgId} className={`rounded-md p-2 border ${m.msgId === selectedHit.msgId ? "border-primary-300 bg-primary-50" : "border-default-200"}`}>
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <div className="text-xs text-default-600 flex items-center gap-2">
                                                {isLikelyQQId(m.senderId) && <QQAvatar qqId={m.senderId} type="user" />}
                                                <span>
                                                    {(m.senderGroupNickname || m.senderNickname || "").trim() || "(未知)"} · {m.senderId}
                                                </span>
                                            </div>
                                            <div className="text-xs text-default-500">{new Date(m.timestamp).toLocaleString("zh-CN")}</div>
                                        </div>
                                        <div className="text-sm text-default-800 break-words mt-1">{highlightTextByTokens(m.messageContent || "", query)}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardBody>
                </Card>
            )}
        </div>
    );
}
