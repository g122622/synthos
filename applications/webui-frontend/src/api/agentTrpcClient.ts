/**
 * Agent tRPC (WebSocket subscription) 客户端
 * 仅用于流式订阅 agentAskStream
 */
import { createTRPCProxyClient, wsLink } from "@trpc/client";
import { createWSClient } from "@trpc/client/links/wsLink";

export interface AgentStreamChunk {
    type: "content" | "tool_start" | "tool_result" | "done" | "error";
    content?: string;
    toolName?: string;
    toolParams?: Record<string, unknown>;
    toolResult?: unknown;
    error?: string;
    isFinished?: boolean;

    conversationId?: string;
    messageId?: string;
    toolsUsed?: string[];
    toolRounds?: number;
    totalUsage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export interface AgentAskStreamInput {
    question: string;
    conversationId?: string;
    sessionId?: string;
    enabledTools?: Array<"rag_search" | "sql_query" | "web_search">;
    maxToolRounds?: number;
    temperature?: number;
    maxTokens?: number;
}

export interface AskStreamChunk {
    type: "content" | "references" | "done" | "error";
    content?: string;
    references?: Array<{
        topicId: string;
        topic: string;
        relevance: number;
    }>;
    error?: string;

    // Provided by webui-backend when it saves the session.
    sessionId?: string;
    isFailed?: boolean;
    failReason?: string;
}

export interface AskStreamInput {
    question: string;
    topK?: number;
    enableQueryRewriter?: boolean;
}

function getAiModelWsUrl() {
    const isHttps = window.location.protocol === "https:";
    const protocol = isHttps ? "wss:" : "ws:";

    // Allow overriding the WS endpoint (useful for advanced deployments).
    const overrideUrl = (import.meta.env.VITE_TRPC_WS_URL || "").trim();

    if (overrideUrl) {
        return overrideUrl;
    }

    // Default: same-origin WebSocket.
    // - Dev (Vite): wss://<host>:5173/trpc, then Vite proxies to http://localhost:3002
    // - Docker (nginx): wss://<host>/trpc, then nginx proxies to http://webui-backend:3002
    // - Direct backend access: ws://localhost:3002/trpc also works when you open UI from that origin
    return `${protocol}//${window.location.host}/trpc`;
}

let _client: any | null = null;

export function getAgentTrpcClient() {
    if (_client) {
        return _client;
    }

    const wsClient = createWSClient({
        url: getAiModelWsUrl()
    });

    _client = createTRPCProxyClient<any>({
        links: [
            wsLink({
                client: wsClient
            })
        ]
    });

    return _client;
}

export function subscribeAgentAskStream(input: AgentAskStreamInput, onData: (chunk: AgentStreamChunk) => void, onError: (err: unknown) => void, onComplete: () => void) {
    const client = getAgentTrpcClient();

    return client.agentAskStream.subscribe(input, {
        onData,
        onError,
        onComplete
    });
}

export function subscribeAskStream(input: AskStreamInput, onData: (chunk: AskStreamChunk) => void, onError: (err: unknown) => void, onComplete: () => void) {
    const client = getAgentTrpcClient();

    return client.askStream.subscribe(input, {
        onData,
        onError: (err: any) => {
            console.error("[RAG] WebSocket/TRPC Error:", err);
            onError(err);
        },
        onComplete
    });
}
