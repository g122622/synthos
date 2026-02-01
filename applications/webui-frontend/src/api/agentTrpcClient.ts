/**
 * Agent tRPC (WebSocket subscription) 客户端
 * 当前仅用于 RAG Ask 的流式订阅（askStream）
 */
import type { AskStreamChunk, AskStreamInput } from "@/types/agent";

import { createTRPCProxyClient, wsLink } from "@trpc/client";
import { createWSClient } from "@trpc/client/links/wsLink";

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
