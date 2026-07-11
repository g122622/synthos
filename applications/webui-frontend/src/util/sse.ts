/**
 * SSE（Server-Sent Events）公共解析工具
 * 使用 fetch + ReadableStream 手动解析 SSE（因为 EventSource 不支持 POST body）
 */

export type SseMessage = {
    event: string;
    data: string;
};

/**
 * 解析单个 SSE 事件块（按空行分隔的一段）
 * 参考 SSE 规范：每行形如 `event:` / `data:` / `:` 注释
 */
export function parseSseBlock(block: string): SseMessage | null {
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

/**
 * 消费 SSE 响应流，按事件块回调
 * @param response fetch 响应，需包含可读 body
 * @param options abort 信号与消息回调
 */
export async function consumeSse(response: Response, options: { signal: AbortSignal; onMessage: (msg: SseMessage) => void }): Promise<void> {
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

                const msg = parseSseBlock(block);

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
