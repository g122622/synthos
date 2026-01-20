/**
 * Agent 对话列表
 */
import type { AgentConversation } from "@/api/agentApi";

import React from "react";
import { Button, Divider, Spinner, cn } from "@heroui/react";
import { MessageSquare } from "lucide-react";

interface AgentConversationListProps {
    activeTab: string;
    agentConversations: AgentConversation[];
    agentLoading: boolean;
    agentHasMore: boolean;
    selectedAgentConversationId?: string;
    onSelectAgentConversation?: (conversationId: string | undefined) => void;
    onLoadMore: () => void;
}

export const AgentConversationList: React.FC<AgentConversationListProps> = ({
    activeTab,
    agentConversations,
    agentLoading,
    agentHasMore,
    selectedAgentConversationId,
    onSelectAgentConversation,
    onLoadMore
}) => {
    if (activeTab !== "agent") {
        return null;
    }

    return (
        <>
            <Divider className="my-3" />
            <div className="px-1">
                <div className="text-xs font-semibold text-default-500 uppercase mb-2">Agent 对话</div>

                {agentLoading && agentConversations.length === 0 ? (
                    <div className="flex justify-center py-4">
                        <Spinner size="sm" />
                    </div>
                ) : agentConversations.length === 0 ? (
                    <div className="text-center py-4 text-default-400 text-sm">暂无对话</div>
                ) : (
                    <div className="space-y-0.5">
                        {agentConversations.map(c => (
                            <button
                                key={c.id}
                                className={cn(
                                    "relative flex w-full cursor-pointer items-center rounded-md p-2 text-left transition-colors",
                                    selectedAgentConversationId === c.id ? "bg-primary-100" : "hover:bg-default-100"
                                )}
                                type="button"
                                onClick={() => onSelectAgentConversation?.(c.id)}
                            >
                                <div
                                    className={cn(
                                        "mr-3 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
                                        selectedAgentConversationId === c.id ? "bg-primary-50" : "bg-default-200"
                                    )}
                                >
                                    <MessageSquare className="w-4 h-4" />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <div className="truncate text-sm font-medium">{c.title || "未命名对话"}</div>
                                    <div className="text-xs text-default-400">
                                        {new Date(c.updatedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {agentHasMore && (
                    <Button className="w-full mt-2 mb-2" isLoading={agentLoading} size="sm" variant="flat" onPress={onLoadMore}>
                        加载更多
                    </Button>
                )}
            </div>
        </>
    );
};
