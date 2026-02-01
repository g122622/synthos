/**
 * Agent API 接口
 * 用于调用 Agent 问答、对话历史相关接口
 */
import type { AgentMessage, AgentConversation, AgentAskRequest, AgentAskResponse, AgentEvent } from "@/types/agent";
import type { ApiResponse } from "@/types/api";

import API_BASE_URL from "./constants/baseUrl";

import fetchWrapper from "@/util/fetchWrapper";
import { mockConfig } from "@/config/mock";
import { mockAgentAsk, mockAgentAskStream, mockGetAgentConversations, mockGetAgentMessages } from "@/mock/agentMock";

// 导出类型供mock和组件使用
export type { AgentMessage, AgentConversation, AgentAskRequest, AgentAskResponse, AgentEvent };

type SseMessage = {
    event: string;
    data: string;
};

function _parseSseBlock(block: string): SseMessage | null {
    // 参考 SSE 规范：按空行分隔 event/data
    const lines = block.split("\n");
    let eventName = "message";
    const dataLines: string[] = [];

    for (const rawLine of lines) {
        const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

        if (!line) {
            continue;
        }

        // 注释行
        if (line.startsWith(":")) {
            continue;
        }

        if (line.startsWith("event:")) {
            eventName = line.slice("event:".length).trim() || "message";
            continue;
        }

        if (line.startsWith("data:")) {
            dataLines.push(line.slice("data:".length).trimStart());
            continue;
        }
    }

    if (dataLines.length === 0) {
        return null;
    }

    return {
        event: eventName,
        data: dataLines.join("\n")
    };
}

async function _consumeSse(response: Response, options: { signal: AbortSignal; onMessage: (msg: SseMessage) => void }): Promise<void> {
    if (!response.body) {
        throw new Error("SSE 响应体为空");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    const handleAbort = () => {
        try {
            void reader.cancel();
        } catch {
            // ignore
        }
    };

    if (options.signal.aborted) {
        handleAbort();

        return;
    }

    options.signal.addEventListener("abort", handleAbort, { once: true });

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });

            // SSE 事件以空行分隔（\n\n）
            while (true) {
                const sepIndex = buffer.indexOf("\n\n");

                if (sepIndex < 0) {
                    break;
                }

                const block = buffer.slice(0, sepIndex);

                buffer = buffer.slice(sepIndex + 2);

                const msg = _parseSseBlock(block);

                if (msg) {
                    options.onMessage(msg);
                }
            }
        }
    } finally {
        options.signal.removeEventListener("abort", handleAbort);
        try {
            reader.releaseLock();
        } catch {
            // ignore
        }
    }
}

// ==================== API 接口 ====================

/**
 * Agent 问答
 * @param request 问答请求参数
 */
export const agentAsk = async (request: AgentAskRequest): Promise<ApiResponse<AgentAskResponse>> => {
    if (mockConfig.agent) {
        return mockAgentAsk(request);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/agent/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request)
    });

    return response.json();
};

/**
 * Agent SSE 流式问答
 * 注意：使用 fetch + ReadableStream 手动解析 SSE（因为 EventSource 不支持 POST body）。
 */
export const agentAskStream = async (
    request: AgentAskRequest,
    options: {
        signal: AbortSignal;
        onEvent: (evt: AgentEvent) => void;
    }
): Promise<void> => {
    if (mockConfig.agent) {
        return mockAgentAskStream(request, options);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/agent/ask/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: options.signal
    });

    if (!response.ok) {
        let errorMsg = `请求失败: ${response.status}`;

        try {
            const json = (await response.json()) as any;

            if (json && typeof json.error === "string") {
                errorMsg = json.error;
            }
        } catch {
            // ignore
        }

        throw new Error(errorMsg);
    }

    await _consumeSse(response, {
        signal: options.signal,
        onMessage: msg => {
            // 后端 data 是 JSON
            let parsed: unknown;

            try {
                parsed = JSON.parse(msg.data);
            } catch {
                return;
            }

            const evt = parsed as AgentEvent;

            if (!evt || typeof (evt as any).type !== "string") {
                return;
            }

            options.onEvent(evt);
        }
    });
};

/**
 * 获取对话列表
 * @param sessionId 会话ID（可选）
 * @param limit 返回结果数量限制
 */
export const getAgentConversations = async (sessionId: string | undefined, beforeUpdatedAt: number | undefined, limit: number = 20): Promise<ApiResponse<AgentConversation[]>> => {
    if (mockConfig.agent) {
        return mockGetAgentConversations(sessionId, beforeUpdatedAt, limit);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/agent/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, beforeUpdatedAt, limit })
    });

    return response.json();
};

/**
 * 获取对话的消息列表
 * @param conversationId 对话ID
 */
export const getAgentConversationsPage = async (sessionId: string | undefined, beforeUpdatedAt: number | undefined, limit: number = 20): Promise<ApiResponse<AgentConversation[]>> => {
    if (mockConfig.agent) {
        return mockGetAgentConversations(sessionId, beforeUpdatedAt, limit);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/agent/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, beforeUpdatedAt, limit })
    });

    return response.json();
};

export const getAgentMessages = async (conversationId: string, beforeTimestamp: number | undefined, limit: number = 20): Promise<ApiResponse<AgentMessage[]>> => {
    if (mockConfig.agent) {
        return mockGetAgentMessages(conversationId, beforeTimestamp, limit);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/agent/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beforeTimestamp, limit })
    });

    return response.json();
};
