/**
 * RAG RPC Router
 * 定义 tRPC router 工厂函数，供 ai-model 实现、webui-backend 调用
 */
import { initTRPC, type AnyRootConfig, type DefaultErrorShape, type Router } from "@trpc/server";
import {
    SearchInputSchema,
    SearchOutput,
    AskInputSchema,
    AskOutput,
    TriggerReportGenerateInputSchema,
    TriggerReportGenerateOutput,
    SendReportEmailInputSchema,
    SendReportEmailOutput,
    AgentAskInputSchema,
    AgentAskOutput
} from "./schemas";

// 使用显式的上下文/元数据类型，避免在消费端与 tRPC AnyRootConfig 不兼容
const t = initTRPC
    .context<any>()
    .meta<any>()
    .create({
        errorFormatter({ shape }): DefaultErrorShape {
            return shape;
        }
    });

/**
 * RAG RPC 实现接口
 * ai-model 需要实现这些方法
 */
export interface RAGRPCImplementation {
    /**
     * 语义搜索
     * @param input 搜索输入
     * @returns 搜索结果列表
     */
    search(input: { query: string; limit: number }): Promise<SearchOutput>;

    /**
     * RAG 问答
     * @param input 问答输入
     * @returns AI 回答及引用来源
     */
    ask(input: { question: string; topK: number; enableQueryRewriter: boolean }): Promise<AskOutput>;

    /**
     * 触发生成日报
     * @param input 日报类型和可选的时间范围
     * @returns 生成结果
     */
    triggerReportGenerate(input: {
        type: "half-daily" | "weekly" | "monthly";
        timeStart?: number;
        timeEnd?: number;
    }): Promise<TriggerReportGenerateOutput>;

    /**
     * 发送日报邮件
     * @param input 日报 ID
     * @returns 发送结果
     */
    sendReportEmail(input: { reportId: string }): Promise<SendReportEmailOutput>;

    /**
     * Agent 问答（流式）
     * @param input Agent 问答输入
     * @param onChunk 流式 chunk 回调
     * @returns Agent 回答结果
     */
    agentAsk(
        input: {
            question: string;
            conversationId?: string;
            sessionId?: string;
            enabledTools?: ("rag_search" | "sql_query" | "web_search")[];
            maxToolRounds?: number;
            temperature?: number;
            maxTokens?: number;
        },
        onChunk: (chunk: any) => void
    ): Promise<AgentAskOutput>;
}

/**
 * 创建 RAG tRPC Router
 * @param impl RPC 方法的具体实现
 * @returns tRPC router 实例
 */
export const createRAGRouter = (impl: RAGRPCImplementation) => {
    const router = t.router({
        search: t.procedure.input(SearchInputSchema).query(async ({ input }) => {
            // Zod schema 验证后，确保类型匹配（limit 有默认值，但类型推断可能为可选）
            const validatedInput: { query: string; limit: number } = {
                query: input.query,
                limit: input.limit ?? 10
            };
            return impl.search(validatedInput);
        }),

        ask: t.procedure.input(AskInputSchema).query(async ({ input }) => {
            // Zod schema 验证后，确保类型匹配（topK 有默认值，但类型推断可能为可选）
            const validatedInput: { question: string; topK: number; enableQueryRewriter: boolean } = {
                question: input.question,
                topK: input.topK ?? 5,
                enableQueryRewriter: input.enableQueryRewriter ?? true
            };
            return impl.ask(validatedInput);
        }),

        triggerReportGenerate: t.procedure.input(TriggerReportGenerateInputSchema).mutation(async ({ input }) => {
            return impl.triggerReportGenerate({
                type: input.type,
                timeStart: input.timeStart,
                timeEnd: input.timeEnd
            });
        }),

        sendReportEmail: t.procedure.input(SendReportEmailInputSchema).mutation(async ({ input }) => {
            return impl.sendReportEmail({
                reportId: input.reportId
            });
        }),

        agentAsk: t.procedure.input(AgentAskInputSchema).mutation(async ({ input }) => {
            // 注意：这是一个简化实现，不支持真正的流式传输
            // 未来可以升级为 tRPC subscription 或使用 SSE
            const validatedInput = {
                question: input.question,
                conversationId: input.conversationId,
                sessionId: input.sessionId,
                enabledTools: input.enabledTools ?? ["rag_search", "sql_query"],
                maxToolRounds: input.maxToolRounds ?? 5,
                temperature: input.temperature ?? 0.7,
                maxTokens: input.maxTokens ?? 2048
            };

            // TODO: 传递 onChunk 回调（当前版本暂不支持，需要升级到 subscription）
            return impl.agentAsk(validatedInput, () => {});
        })
    });

    // 将 _config 放宽到 AnyRootConfig，便于跨包消费（如 webui-backend 客户端）
    type RouterRecord = (typeof router._def)["record"];
    type RAGRouterDef = {
        _config: AnyRootConfig;
        router: true;
        procedures: (typeof router._def)["procedures"];
        record: RouterRecord;
        queries: (typeof router._def)["queries"];
        mutations: (typeof router._def)["mutations"];
        subscriptions: (typeof router._def)["subscriptions"];
    };

    const typedRouter = router as unknown as Router<RAGRouterDef> & RouterRecord;
    return typedRouter;
};

/**
 * RAG Router 类型
 * 供 webui-backend 创建类型安全的 client
 */
export type RAGRouter = ReturnType<typeof createRAGRouter>;
