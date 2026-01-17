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

function getAiModelWsUrl() {
    if (window.location.hostname === "localhost") {
        return "ws://localhost:7979";
    }

    return "ws://" + window.location.host;
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
