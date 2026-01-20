import { initTRPC } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { container } from "tsyringe";
import { TOKENS } from "../di/tokens";
import type { RAGClient } from "./aiModelClient";
import {
    AgentAskInputSchema,
    AskInputSchema,
    AgentStreamChunk,
    AskStreamChunk
} from "@root/common/rpc/ai-model/schemas";

const t = initTRPC.create();

export const appRouter = t.router({
    agentAskStream: t.procedure.input(AgentAskInputSchema).subscription(({ input }) => {
        return observable<AgentStreamChunk>(emit => {
            const client = container.resolve<RAGClient>(TOKENS.RAGClient);

            // 重要：需要处理类型匹配，因为 RPC Client 和 Subscription 类型定义虽然相同，但 TS 可能会报错
            // 如果 rpc-client 的 subscribe 返回的是 { unsubscribe: ... }
            const sub = client.agentAskStream.subscribe(input, {
                onData: data => emit.next(data),
                onError: err => emit.error(err),
                onComplete: () => emit.complete()
            });
            return () => sub.unsubscribe();
        });
    }),
    askStream: t.procedure.input(AskInputSchema).subscription(({ input }) => {
        return observable<AskStreamChunk>(emit => {
            const client = container.resolve<RAGClient>(TOKENS.RAGClient);

            const sub = client.askStream.subscribe(input, {
                onData: (data: unknown) => emit.next(data as AskStreamChunk),
                onError: err => emit.error(err),
                onComplete: () => emit.complete()
            });
            return () => sub.unsubscribe();
        });
    })
});

export type AppRouter = typeof appRouter;
