import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Card, CardBody, Chip, Input, Spinner } from "@heroui/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { RefreshCw } from "lucide-react";

import DefaultLayout from "@/layouts/default";
import { Notification } from "@/util/Notification";
import { queryLogs, type LogItem, type LogLevel } from "@/api/logApi";

const ALL_LEVELS: LogLevel[] = ["debug", "info", "success", "warning", "error"];

function parseMsParam(value: string | null): number | undefined {
    if (!value) {
        return undefined;
    }

    const n = Number.parseInt(value, 10);

    if (!Number.isFinite(n)) {
        return undefined;
    }

    return n;
}

function parseLevelsParam(value: string | null): LogLevel[] | undefined {
    if (!value) {
        return undefined;
    }

    const parts = value
        .split(",")
        .map(p => p.trim())
        .filter(Boolean);

    const levels: LogLevel[] = [];

    for (const p of parts) {
        if (ALL_LEVELS.includes(p as LogLevel)) {
            levels.push(p as LogLevel);
        }
    }

    if (levels.length === 0) {
        return undefined;
    }

    return Array.from(new Set(levels));
}

function msToDatetimeLocalValue(ms: number): string {
    const d = new Date(ms);

    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function datetimeLocalValueToMs(value: string): number | undefined {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
        return undefined;
    }

    const d = new Date(trimmed);
    const ms = d.getTime();

    if (!Number.isFinite(ms)) {
        return undefined;
    }

    return ms;
}

function levelChipColor(level: LogLevel): "default" | "primary" | "secondary" | "success" | "warning" | "danger" {
    if (level === "debug") return "default";
    if (level === "info") return "primary";
    if (level === "success") return "success";
    if (level === "warning") return "warning";

    return "danger";
}

export default function SystemLogsPage() {
    const [searchParams, setSearchParams] = useSearchParams();

    const startTime = useMemo(() => parseMsParam(searchParams.get("startTime")), [searchParams]);
    const endTime = useMemo(() => parseMsParam(searchParams.get("endTime")), [searchParams]);
    const levels = useMemo(() => parseLevelsParam(searchParams.get("levels")), [searchParams]);

    const [formStart, setFormStart] = useState<string>(startTime !== undefined ? msToDatetimeLocalValue(startTime) : "");
    const [formEnd, setFormEnd] = useState<string>(endTime !== undefined ? msToDatetimeLocalValue(endTime) : "");
    const [formLevels, setFormLevels] = useState<Set<LogLevel>>(new Set(levels || ALL_LEVELS));

    const [items, setItems] = useState<LogItem[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);
    const [hasMore, setHasMore] = useState<boolean>(false);
    const [nextBefore, setNextBefore] = useState<number | null>(null);

    const parentRef = useRef<HTMLDivElement | null>(null);
    const pendingPrependAdjustRef = useRef<{ prevScrollTop: number; prevScrollHeight: number } | null>(null);
    const didInitialScrollRef = useRef<boolean>(false);

    const requestLevels = useMemo(() => {
        if (formLevels.size === 0 || formLevels.size === ALL_LEVELS.length) {
            return undefined;
        }

        return Array.from(formLevels);
    }, [formLevels]);

    const applyFiltersToUrl = useCallback(() => {
        const next = new URLSearchParams(searchParams);

        const startMs = datetimeLocalValueToMs(formStart);
        const endMs = datetimeLocalValueToMs(formEnd);

        if (startMs !== undefined) {
            next.set("startTime", String(startMs));
        } else {
            next.delete("startTime");
        }

        if (endMs !== undefined) {
            next.set("endTime", String(endMs));
        } else {
            next.delete("endTime");
        }

        if (requestLevels && requestLevels.length > 0) {
            next.set("levels", requestLevels.join(","));
        } else {
            next.delete("levels");
        }

        setSearchParams(next);
    }, [formStart, formEnd, requestLevels, searchParams, setSearchParams]);

    const loadFirstPage = useCallback(async () => {
        setLoading(true);
        setItems([]);
        setNextBefore(null);
        setHasMore(false);
        didInitialScrollRef.current = false;

        const req = {
            limit: 100,
            startTime,
            endTime,
            levels
        };

        try {
            const resp = await queryLogs(req);

            if (!resp.success) {
                const msg = resp.message || resp.error || "未知错误";

                Notification.error({
                    title: "加载日志失败",
                    description: msg
                });

                return;
            }

            const serverItems = resp.data.items;
            const asc = [...serverItems].reverse();

            setItems(asc);
            setNextBefore(resp.data.nextBefore);
            setHasMore(resp.data.hasMore);
        } finally {
            setLoading(false);
        }
    }, [endTime, levels, startTime]);

    const loadMoreOlder = useCallback(async () => {
        if (loadingMore) {
            return;
        }

        if (!hasMore) {
            return;
        }

        if (nextBefore === null) {
            return;
        }

        const container = parentRef.current;

        if (!container) {
            return;
        }

        setLoadingMore(true);

        pendingPrependAdjustRef.current = {
            prevScrollTop: container.scrollTop,
            prevScrollHeight: container.scrollHeight
        };

        const req = {
            limit: 100,
            before: nextBefore,
            startTime,
            endTime,
            levels
        };

        try {
            const resp = await queryLogs(req);

            if (!resp.success) {
                const msg = resp.message || resp.error || "未知错误";

                Notification.error({
                    title: "加载更多日志失败",
                    description: msg
                });
                pendingPrependAdjustRef.current = null;

                return;
            }

            const serverItems = resp.data.items;
            const asc = [...serverItems].reverse();

            setItems(prev => {
                const merged = [...asc, ...prev];

                // 轻量去重：避免 before 精度不足造成重复
                const seen = new Set<string>();
                const deduped: LogItem[] = [];

                for (const it of merged) {
                    const key = `${it.timestamp}|${it.level}|${it.raw}`;

                    if (seen.has(key)) {
                        continue;
                    }
                    seen.add(key);
                    deduped.push(it);
                }

                return deduped;
            });

            setNextBefore(resp.data.nextBefore);
            setHasMore(resp.data.hasMore);
        } finally {
            setLoadingMore(false);
        }
    }, [endTime, hasMore, levels, loadingMore, nextBefore, startTime]);

    // URL 参数变化 -> 同步表单默认值 + 重新加载
    useEffect(() => {
        setFormStart(startTime !== undefined ? msToDatetimeLocalValue(startTime) : "");
        setFormEnd(endTime !== undefined ? msToDatetimeLocalValue(endTime) : "");
        setFormLevels(new Set(levels || ALL_LEVELS));

        loadFirstPage();
    }, [endTime, levels, loadFirstPage, startTime]);

    // prepend 后保持视窗位置不跳
    useEffect(() => {
        const pending = pendingPrependAdjustRef.current;
        const container = parentRef.current;

        if (!pending || !container) {
            return;
        }

        pendingPrependAdjustRef.current = null;

        requestAnimationFrame(() => {
            const newScrollHeight = container.scrollHeight;
            const delta = newScrollHeight - pending.prevScrollHeight;

            container.scrollTop = pending.prevScrollTop + delta;
        });
    }, [items.length]);

    const rowVirtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 56,
        overscan: 20
    });

    // 初次加载后滚动到底部
    useEffect(() => {
        if (didInitialScrollRef.current) {
            return;
        }

        if (loading) {
            return;
        }

        if (items.length === 0) {
            return;
        }

        didInitialScrollRef.current = true;
        rowVirtualizer.scrollToIndex(items.length - 1, { align: "end" });
    }, [items.length, loading, rowVirtualizer]);

    const onScroll = useCallback(() => {
        const container = parentRef.current;

        if (!container) {
            return;
        }

        if (container.scrollTop < 200) {
            loadMoreOlder();
        }
    }, [loadMoreOlder]);

    const levelButtons = (
        <div className="flex flex-wrap gap-2">
            {ALL_LEVELS.map(lv => {
                const selected = formLevels.has(lv);

                return (
                    <Chip
                        key={lv}
                        color={levelChipColor(lv)}
                        variant={selected ? "solid" : "bordered"}
                        onClick={() => {
                            setFormLevels(prev => {
                                const next = new Set(prev);

                                if (next.has(lv)) {
                                    next.delete(lv);
                                } else {
                                    next.add(lv);
                                }

                                return next;
                            });
                        }}
                    >
                        {lv}
                    </Chip>
                );
            })}
        </div>
    );

    return (
        <DefaultLayout>
            <div className="p-6 min-h-screen">
                <div className="flex flex-col gap-3 mb-4">
                    <div className="flex items-end justify-between gap-3 flex-wrap">
                        <div>
                            <h1 className="text-3xl font-bold mb-1">日志查看</h1>
                            <p className="text-gray-400 text-sm">每次加载 100 条最新日志，向上滚动自动加载更旧日志</p>
                        </div>

                        <div className="flex gap-2">
                            <Button color="primary" isDisabled={loading} startContent={<RefreshCw size={16} />} variant="flat" onClick={() => loadFirstPage()}>
                                刷新
                            </Button>
                        </div>
                    </div>

                    <Card className="border-none">
                        <CardBody className="flex flex-col gap-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <Input label="开始时间" type="datetime-local" value={formStart} onValueChange={setFormStart} />
                                <Input label="结束时间" type="datetime-local" value={formEnd} onValueChange={setFormEnd} />
                            </div>

                            <div>
                                <div className="text-sm text-gray-400 mb-2">级别筛选</div>
                                {levelButtons}
                            </div>

                            <div className="flex gap-2 flex-wrap">
                                <Button color="primary" onClick={applyFiltersToUrl}>
                                    应用筛选（写入URL）
                                </Button>
                                <Button
                                    variant="flat"
                                    onClick={() => {
                                        setFormStart("");
                                        setFormEnd("");
                                        setFormLevels(new Set(ALL_LEVELS));
                                    }}
                                >
                                    重置
                                </Button>
                            </div>
                        </CardBody>
                    </Card>
                </div>

                <Card className="border-none">
                    <CardBody>
                        {loading ? (
                            <div className="flex items-center justify-center py-10">
                                <Spinner label="加载中..." />
                            </div>
                        ) : (
                            <div ref={parentRef} className="h-[70vh] overflow-auto" onScroll={onScroll}>
                                <div
                                    style={{
                                        height: `${rowVirtualizer.getTotalSize()}px`,
                                        width: "100%",
                                        position: "relative"
                                    }}
                                >
                                    {rowVirtualizer.getVirtualItems().map(virtualRow => {
                                        const item = items[virtualRow.index];
                                        const t = new Date(item.timestamp).toLocaleString();

                                        return (
                                            <div
                                                key={virtualRow.key}
                                                className="border-b border-gray-800 px-3 py-2"
                                                style={{
                                                    position: "absolute",
                                                    top: 0,
                                                    left: 0,
                                                    width: "100%",
                                                    transform: `translateY(${virtualRow.start}px)`
                                                }}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="shrink-0 w-[190px] text-xs text-gray-400">{t}</div>
                                                    <div className="shrink-0">
                                                        <Chip color={levelChipColor(item.level)} size="sm" variant="flat">
                                                            {item.level}
                                                        </Chip>
                                                    </div>
                                                    <div className="flex-1 text-sm font-mono whitespace-pre-wrap break-words">{item.raw}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="py-2 text-center text-xs text-gray-500">{loadingMore ? "正在加载更旧日志..." : hasMore ? "向上滚动加载更多" : "没有更多日志了"}</div>
                            </div>
                        )}
                    </CardBody>
                </Card>
            </div>
        </DefaultLayout>
    );
}
