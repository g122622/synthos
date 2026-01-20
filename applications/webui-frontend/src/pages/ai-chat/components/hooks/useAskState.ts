import type { AskResponse, ReferenceItem } from "@/api/ragApi";

import { useCallback, useEffect, useRef, useState } from "react";

import { subscribeAskStream } from "@/api/agentTrpcClient";

type AskDoneChunk = {
    type: "done";
    sessionId?: string;
    isFailed?: boolean;
    failReason?: string;
};

interface UseAskStateOptions {
    onReferences?: (refs: ReferenceItem[]) => void;
    onDone?: (chunk: AskDoneChunk) => void;
}

/**
 * 流式问答：订阅管理 + UI 状态
 */
export function useAskState({ onReferences, onDone }: UseAskStateOptions) {
    const [askResponse, setAskResponse] = useState<AskResponse | null>(null);
    const [askLoading, setAskLoading] = useState(false);
    const [currentSessionIsFailed, setCurrentSessionIsFailed] = useState(false);
    const [currentSessionFailReason, setCurrentSessionFailReason] = useState("");

    const askUnsubscribeRef = useRef<{ unsubscribe: () => void } | null>(null);
    const currentAnswerRef = useRef("");
    const currentReferencesRef = useRef<ReferenceItem[]>([]);

    const stopAsk = useCallback(() => {
        if (askUnsubscribeRef.current) {
            askUnsubscribeRef.current.unsubscribe();
            askUnsubscribeRef.current = null;
        }
    }, []);

    useEffect(() => {
        return () => {
            stopAsk();
        };
    }, [stopAsk]);

    const handleAsk = useCallback(
        async (params: { question: string; topK: number; enableQueryRewriter: boolean }) => {
            const { question, topK, enableQueryRewriter } = params;

            if (!question.trim()) {
                return;
            }

            setAskLoading(true);
            setCurrentSessionIsFailed(false);
            setCurrentSessionFailReason("");

            // 重置
            setAskResponse({ answer: "", references: [] });
            currentAnswerRef.current = "";
            currentReferencesRef.current = [];

            // 清理旧订阅
            stopAsk();

            try {
                const subscription = subscribeAskStream(
                    {
                        question,
                        topK,
                        enableQueryRewriter
                    },
                    chunk => {
                        if (chunk.type === "content" && chunk.content) {
                            const content = chunk.content;

                            currentAnswerRef.current += content;
                            setAskResponse(prev => {
                                if (!prev) {
                                    return { answer: content, references: [] };
                                }

                                return { ...prev, answer: prev.answer + content };
                            });
                        } else if (chunk.type === "references" && chunk.references) {
                            const refs = chunk.references as ReferenceItem[];

                            currentReferencesRef.current = refs;
                            setAskResponse(prev => {
                                if (!prev) {
                                    return { answer: "", references: refs };
                                }

                                return { ...prev, references: refs };
                            });
                            onReferences?.(refs);
                        } else if (chunk.type === "error") {
                            console.error("Ask stream error:", chunk.error);
                            setCurrentSessionIsFailed(true);
                            setCurrentSessionFailReason(chunk.error || "");
                            setAskResponse(prev => (prev ? { ...prev, answer: prev.answer + `\n\n[Error: ${chunk.error}]` } : null));
                        } else if (chunk.type === "done") {
                            onDone?.(chunk as AskDoneChunk);
                            if ((chunk as AskDoneChunk).isFailed) {
                                setCurrentSessionIsFailed(true);
                                setCurrentSessionFailReason((chunk as AskDoneChunk).failReason || "");
                            }
                        }
                    },
                    err => {
                        console.error("Ask subscription error:", err);
                        setAskLoading(false);
                    },
                    () => {
                        setAskLoading(false);
                        askUnsubscribeRef.current = null;
                    }
                );

                askUnsubscribeRef.current = subscription;
            } catch (error) {
                console.error("问答出错:", error);
                setAskLoading(false);
            }
        },
        [onDone, onReferences, stopAsk]
    );

    return {
        askResponse,
        setAskResponse,
        askLoading,
        currentSessionIsFailed,
        setCurrentSessionIsFailed,
        currentSessionFailReason,
        setCurrentSessionFailReason,
        handleAsk,
        stopAsk
    };
}
