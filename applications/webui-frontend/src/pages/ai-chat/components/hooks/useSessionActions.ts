import type { AiChatTab, AskResponse, ReferenceItem } from "@/types/index";

import { useCallback } from "react";

import { getSessionDetail } from "@/api/ragChatHistoryApi";

interface UseSessionActionsOptions {
    activeTab: AiChatTab;
    isMobile: boolean;
    stopAsk: () => void;
    resetSearch: () => void;
    loadTopicStatuses: (topicIds: string[]) => Promise<void>;

    setSelectedSessionId: (id: string | null) => void;
    setSelectedAgentConversationId: (id: string | undefined) => void;
    setAgentRefreshTrigger: (updater: (prev: number) => number) => void;
    setQuestion: (q: string) => void;
    setAskResponse: (resp: AskResponse | null) => void;
    setCurrentSessionIsFailed: (failed: boolean) => void;
    setCurrentSessionFailReason: (reason: string) => void;
    setTopK: (k: number) => void;
    setEnableQueryRewriter: (v: boolean) => void;
    setActiveTab: (tab: AiChatTab) => void;
    setMobileDrawerOpen: (open: boolean) => void;
}

/**
 * 会话选择/新建逻辑（包含加载详情与移动端收起）
 */
export function useSessionActions({
    activeTab,
    isMobile,
    stopAsk,
    resetSearch,
    loadTopicStatuses,
    setSelectedSessionId,
    setSelectedAgentConversationId,
    setAgentRefreshTrigger,
    setQuestion,
    setAskResponse,
    setCurrentSessionIsFailed,
    setCurrentSessionFailReason,
    setTopK,
    setEnableQueryRewriter,
    setActiveTab,
    setMobileDrawerOpen
}: UseSessionActionsOptions) {
    const handleSelectSession = useCallback(
        async (sessionId: string | null) => {
            setSelectedSessionId(sessionId);
            setSelectedAgentConversationId(undefined);
            stopAsk();

            if (!sessionId) {
                return;
            }

            try {
                const response = await getSessionDetail(sessionId);

                if (!response.success || !response.data) {
                    return;
                }

                const session = response.data;

                setQuestion(session.question);
                setAskResponse({
                    answer: session.answer,
                    references: session.references as unknown as ReferenceItem[]
                });
                setCurrentSessionIsFailed(!!session.isFailed);
                setCurrentSessionFailReason(session.failReason || "");
                setTopK(session.topK);
                setEnableQueryRewriter(session.enableQueryRewriter);

                if (activeTab !== "agent") {
                    setActiveTab("ask");
                }
                if (isMobile) {
                    setMobileDrawerOpen(false);
                }

                const topicIds = session.references.map((ref: ReferenceItem) => ref.topicId);

                await loadTopicStatuses(topicIds);
            } catch (error) {
                console.error("加载会话详情失败:", error);
            }
        },
        [
            activeTab,
            isMobile,
            loadTopicStatuses,
            setActiveTab,
            setAskResponse,
            setCurrentSessionFailReason,
            setCurrentSessionIsFailed,
            setEnableQueryRewriter,
            setMobileDrawerOpen,
            setQuestion,
            setSelectedAgentConversationId,
            setSelectedSessionId,
            setTopK,
            stopAsk
        ]
    );

    const handleNewSession = useCallback(() => {
        setSelectedSessionId(null);
        setSelectedAgentConversationId(undefined);
        setAgentRefreshTrigger(prev => prev + 1);
        setQuestion("");
        setAskResponse(null);
        setCurrentSessionIsFailed(false);
        setCurrentSessionFailReason("");
        resetSearch();
        stopAsk();

        if (isMobile) {
            setMobileDrawerOpen(false);
        }
    }, [
        isMobile,
        resetSearch,
        setAgentRefreshTrigger,
        setAskResponse,
        setCurrentSessionFailReason,
        setCurrentSessionIsFailed,
        setMobileDrawerOpen,
        setQuestion,
        setSelectedAgentConversationId,
        setSelectedSessionId,
        stopAsk
    ]);

    return { handleSelectSession, handleNewSession };
}
