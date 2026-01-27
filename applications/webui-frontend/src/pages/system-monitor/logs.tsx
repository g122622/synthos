import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Card, Chip, Input, Spinner, Select, SelectItem } from "@heroui/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { RefreshCw, Filter, Trash2, Zap, ZapOff, Box, FunctionSquare, Bug, Info, CircleCheck, TriangleAlert, CircleX } from "lucide-react";

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

type ParsedStructuredLog = {
    timeText?: string;
    className?: string;
    methodName?: string;
    message: string;
};

function parseStructuredLog(raw: string): ParsedStructuredLog {
    // 去除掉开头的两个字符
    raw = raw.slice(2);

    const isSpace = (ch: string | undefined): boolean => {
        return ch === " " || ch === "\t";
    };

    const skipSpaces = (s: string, start: number): number => {
        let i = start;

        while (i < s.length && isSpace(s[i])) {
            i += 1;
        }

        return i;
    };

    const readBracketGroup = (s: string, start: number): { value: string; next: number } | null => {
        const i = skipSpaces(s, start);

        if (s[i] !== "[") {
            return null;
        }

        const close = s.indexOf("]", i + 1);

        if (close < 0) {
            return null;
        }

        const value = s.slice(i + 1, close).trim();

        return {
            value,
            next: close + 1
        };
    };

    let cursor = 0;

    cursor = skipSpaces(raw, cursor);

    const timeGroup = readBracketGroup(raw, cursor);

    if (!timeGroup) {
        return { message: raw };
    }
    cursor = timeGroup.next;

    const levelGroup = readBracketGroup(raw, cursor);

    if (!levelGroup) {
        return { timeText: timeGroup.value || undefined, message: raw.slice(cursor).trimStart() };
    }
    cursor = levelGroup.next;

    const classGroup = readBracketGroup(raw, cursor);

    if (!classGroup) {
        return {
            timeText: timeGroup.value || undefined,
            message: raw.slice(cursor).trimStart()
        };
    }
    cursor = classGroup.next;

    const methodGroup = readBracketGroup(raw, cursor);

    if (!methodGroup) {
        return {
            timeText: timeGroup.value || undefined,
            className: classGroup.value || undefined,
            message: raw.slice(cursor).trimStart()
        };
    }
    cursor = methodGroup.next;

    const res = {
        timeText: timeGroup.value || undefined,
        className: classGroup.value || undefined,
        methodName: methodGroup.value || undefined,
        message: raw.slice(cursor).trimStart()
    };

    return res;
}

function levelIcon(level: LogLevel): JSX.Element {
    if (level === "debug") {
        return <Bug className="text-gray-400" size={14} />;
    }

    if (level === "info") {
        return <Info className="text-blue-400" size={14} />;
    }

    if (level === "success") {
        return <CircleCheck className="text-green-400" size={14} />;
    }

    if (level === "warning") {
        return <TriangleAlert className="text-yellow-400" size={14} />;
    }

    return <CircleX className="text-red-400" size={14} />;
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
    const [refreshInterval, setRefreshInterval] = useState<string>("0"); // "0" | "2000" | "5000" | "10000"

    const parentRef = useRef<HTMLDivElement | null>(null);
    const pendingPrependAdjustRef = useRef<{ prevScrollTop: number; prevScrollHeight: number } | null>(null);
    const didInitialScrollRef = useRef<boolean>(false);
    const itemsRef = useRef(items);
    const shouldAutoScrollRef = useRef(false);

    itemsRef.current = items; // Keep sync for interval

    const requestLevels = useMemo(() => {
        if (formLevels.size === 0 || formLevels.size === ALL_LEVELS.length) {
            return undefined;
        }

        return Array.from(formLevels);
    }, [formLevels]);

    const loadNewer = useCallback(async () => {
        const currentItems = itemsRef.current;

        if (currentItems.length === 0) return;

        const lastItem = currentItems[currentItems.length - 1];
        // 增量查询：请求 lastItem.timestamp + 1 之后的日志
        const req = {
            limit: 100,
            startTime: lastItem.timestamp + 1,
            levels: requestLevels // 复用当前的级别筛选
            // endTime is ignored or should be open-ended for real-time
        };

        try {
            // 静默加载，不设置全局 loading
            const resp = await queryLogs(req);

            if (!resp.success) {
                console.error("Auto refresh failed", resp);

                return;
            }

            const newItems = resp.data.items;

            if (newItems.length === 0) {
                return;
            }

            const newAsc = [...newItems].reverse();

            // 检测当前是否在底部 (允许 100px 误差)
            const container = parentRef.current;
            const isAtBottom = container ? container.scrollHeight - container.scrollTop - container.clientHeight < 100 : false;

            shouldAutoScrollRef.current = isAtBottom;

            setItems(prev => {
                const merged = [...prev, ...newAsc];
                // 简单的尾部去重
                const seen = new Set<string>();
                const deduped: LogItem[] = [];

                for (const it of merged) {
                    const key = `${it.timestamp}|${it.level}|${it.raw}`;

                    if (seen.has(key)) continue;
                    seen.add(key);
                    deduped.push(it);
                }
                if (deduped.length > 5000) return deduped.slice(deduped.length - 5000);

                return deduped;
            });
        } catch (e) {
            console.error("Auto refresh error", e);
        }
    }, [requestLevels]);

    // 自动刷新定时器
    useEffect(() => {
        const ms = parseInt(refreshInterval, 10);

        if (ms <= 0) return;

        const id = setInterval(loadNewer, ms);

        return () => clearInterval(id);
    }, [refreshInterval, loadNewer]);

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
        estimateSize: () => 60,
        overscan: 20
    });

    // 滚动处理：初始加载 或 自动刷新跟随
    useEffect(() => {
        // Case 1: Initial load
        if (!didInitialScrollRef.current && !loading && items.length > 0) {
            didInitialScrollRef.current = true;
            setTimeout(() => {
                rowVirtualizer.scrollToIndex(items.length - 1, { align: "end" });
            }, 50);

            return;
        }

        // Case 2: Auto refresh follow
        if (shouldAutoScrollRef.current && !loading && !loadingMore) {
            shouldAutoScrollRef.current = false; // consume it
            setTimeout(() => {
                rowVirtualizer.scrollToIndex(items.length - 1, { align: "end" });
            }, 50);
        }
    }, [items.length, loading, rowVirtualizer, loadingMore]);

    const onScroll = useCallback(() => {
        const container = parentRef.current;

        if (!container) return;

        if (container.scrollTop < 200) {
            loadMoreOlder();
        }
    }, [loadMoreOlder]);

    return (
        <DefaultLayout>
            <div className="flex flex-col h-[calc(100vh-4rem)] bg-content1/50 overflow-hidden">
                {/* Header & Controls */}
                <div className="flex-none p-4 md:p-6 bg-background/80 backdrop-blur-md border-b border-divider z-10 flex flex-col gap-4 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">系统日志</h1>
                            <p className="text-default-500 text-sm mt-1">查看系统运行日志与调试信息</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Select
                                aria-label="自动刷新频率"
                                className="w-32"
                                placeholder="选择频率"
                                selectedKeys={[refreshInterval]}
                                size="sm"
                                startContent={refreshInterval === "0" ? <ZapOff className="text-default-400" size={14} /> : <Zap className="text-warning-500" size={14} />}
                                onChange={e => {
                                    setRefreshInterval(e.target.value);
                                    if (e.target.value !== "0") {
                                        setFormEnd(""); // 启用自动刷新时，清除结束时间，进入实时模式
                                    }
                                }}
                            >
                                <SelectItem key="0" textValue="手动刷新">
                                    手动刷新
                                </SelectItem>
                                <SelectItem key="2000" textValue="2秒">
                                    每 2 秒
                                </SelectItem>
                                <SelectItem key="5000" textValue="5秒">
                                    每 5 秒
                                </SelectItem>
                                <SelectItem key="10000" textValue="10秒">
                                    每 10 秒
                                </SelectItem>
                                <SelectItem key="30000" textValue="30秒">
                                    每 30 秒
                                </SelectItem>
                            </Select>

                            <Button color="primary" isLoading={loading} size="sm" startContent={!loading && <RefreshCw size={14} />} variant="flat" onClick={() => loadFirstPage()}>
                                刷新
                            </Button>
                        </div>
                    </div>

                    <Card className="shadow-sm border-none bg-content2/50">
                        <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                            <div className="md:col-span-5 grid grid-cols-2 gap-4">
                                <Input
                                    classNames={{ inputWrapper: "bg-background" }}
                                    label="开始时间"
                                    labelPlacement="inside"
                                    size="sm"
                                    type="datetime-local"
                                    value={formStart}
                                    variant="bordered"
                                    onValueChange={setFormStart}
                                />
                                <Input
                                    classNames={{ inputWrapper: "bg-background" }}
                                    label="结束时间"
                                    labelPlacement="inside"
                                    size="sm"
                                    type="datetime-local"
                                    value={formEnd}
                                    variant="bordered"
                                    onValueChange={setFormEnd}
                                />
                            </div>

                            <div className="md:col-span-5 flex flex-col gap-2">
                                <span className="text-xs font-medium text-default-500">日志级别</span>
                                <div className="flex flex-wrap gap-2">
                                    {ALL_LEVELS.map(lv => {
                                        const selected = formLevels.has(lv);

                                        return (
                                            <Chip
                                                key={lv}
                                                className="cursor-pointer select-none transition-all hover:opacity-80 active:scale-95"
                                                color={levelChipColor(lv)}
                                                size="sm"
                                                variant={selected ? "flat" : "light"}
                                                onClick={() => {
                                                    setFormLevels(prev => {
                                                        const next = new Set(prev);

                                                        if (next.has(lv)) next.delete(lv);
                                                        else next.add(lv);

                                                        return next;
                                                    });
                                                }}
                                            >
                                                {lv.toUpperCase()}
                                            </Chip>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="md:col-span-2 flex items-center justify-end gap-2 h-full">
                                <Button color="primary" size="sm" startContent={<Filter size={14} />} onClick={applyFiltersToUrl}>
                                    应用筛选
                                </Button>
                                <Button
                                    isIconOnly
                                    size="sm"
                                    title="重置筛选"
                                    variant="light"
                                    onClick={() => {
                                        setFormStart("");
                                        setFormEnd("");
                                        setFormLevels(new Set(ALL_LEVELS));
                                    }}
                                >
                                    <Trash2 className="text-default-500" size={16} />
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Logs Area */}
                <div className="flex-1 overflow-hidden relative bg-[#1e1e1e] text-gray-300 font-mono text-sm">
                    {loading && items.length === 0 ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20 bg-black/20 backdrop-blur-[1px]">
                            <Spinner color="white" label="加载日志中..." />
                        </div>
                    ) : items.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4">
                            <div className="p-4 rounded-full bg-white/5">
                                <Filter size={32} />
                            </div>
                            <p>没有找到日志记录</p>
                        </div>
                    ) : (
                        <div ref={parentRef} className="h-full w-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent" onScroll={onScroll}>
                            <div
                                style={{
                                    height: `${rowVirtualizer.getTotalSize()}px`,
                                    width: "100%",
                                    position: "relative"
                                }}
                            >
                                {rowVirtualizer.getVirtualItems().map(virtualRow => {
                                    const item = items[virtualRow.index];
                                    const parsed = parseStructuredLog(item.raw);

                                    return (
                                        <div
                                            key={virtualRow.key}
                                            ref={rowVirtualizer.measureElement}
                                            className="absolute top-0 left-0 w-full px-2 py-1 hover:bg-white/5 border-b border-white/5 flex items-start gap-2 transition-colors group text-xs"
                                            data-index={virtualRow.index}
                                            style={{
                                                transform: `translateY(${virtualRow.start}px)`
                                            }}
                                        >
                                            <span
                                                className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                                                    item.level === "error"
                                                        ? "bg-red-500/20 text-red-400"
                                                        : item.level === "warning"
                                                          ? "bg-yellow-500/20 text-yellow-400"
                                                          : item.level === "info"
                                                            ? "bg-blue-500/20 text-blue-400"
                                                            : item.level === "success"
                                                              ? "bg-green-500/20 text-green-400"
                                                              : "bg-gray-500/20 text-gray-400"
                                                }`}
                                            >
                                                {levelIcon(item.level)}
                                            </span>
                                            <div className="flex-1 min-w-0 break-all whitespace-pre-wrap leading-relaxed opacity-90 font-mono">
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                    {parsed.timeText && (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-gray-400 select-none">
                                                            {parsed.timeText}
                                                        </span>
                                                    )}

                                                    {parsed.className && (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-violet-300 select-none">
                                                            <Box className="text-violet-300/80" size={12} />
                                                            <span>{parsed.className}</span>
                                                        </span>
                                                    )}

                                                    {parsed.methodName && (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-sky-300 select-none">
                                                            <FunctionSquare className="text-sky-300/80" size={12} />
                                                            <span>{parsed.methodName}</span>
                                                        </span>
                                                    )}

                                                    <span className="text-gray-200">{parsed.message}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {loadingMore && (
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1 rounded-full shadow-lg flex items-center gap-2 z-30 animate-in fade-in slide-in-from-top-2">
                                    <Spinner color="white" size="sm" />
                                    <span>加载更多历史日志...</span>
                                </div>
                            )}

                            {hasMore && !loadingMore && (
                                <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-blue-500/10 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </DefaultLayout>
    );
}
