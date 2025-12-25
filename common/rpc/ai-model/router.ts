/**
 * RAG RPC Router
 * 定义 tRPC router 工厂函数，供 ai-model 实现、webui-backend 调用
 */
import {
    initTRPC,
    type AnyRootConfig,
    type DefaultErrorShape,
    type Router
} from "@trpc/server";
import {
    SearchInputSchema,
    SearchOutput,
    AskInputSchema,
    AskOutput,
    TriggerReportGenerateInputSchema,
    TriggerReportGenerateOutput
} from "./schemas";

// 使用显式的上下文/元数据类型，避免在消费端与 tRPC AnyRootConfig 不兼容
const t = initTRPC.context<any>().meta<any>().create({
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
    ask(input: { question: string; topK: number }): Promise<AskOutput>;

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
            const validatedInput: { question: string; topK: number } = {
                question: input.question,
                topK: input.topK ?? 5
            };
            return impl.ask(validatedInput);
        }),

        triggerReportGenerate: t.procedure.input(TriggerReportGenerateInputSchema).mutation(async ({ input }) => {
            return impl.triggerReportGenerate({
                type: input.type,
                timeStart: input.timeStart,
                timeEnd: input.timeEnd
            });
        })
    });

    // 将 _config 放宽到 AnyRootConfig，便于跨包消费（如 webui-backend 客户端）
    type RouterRecord = typeof router._def["record"];
    type RAGRouterDef = {
        _config: AnyRootConfig;
        router: true;
        procedures: typeof router._def["procedures"];
        record: RouterRecord;
        queries: typeof router._def["queries"];
        mutations: typeof router._def["mutations"];
        subscriptions: typeof router._def["subscriptions"];
    };

    const typedRouter = router as unknown as Router<RAGRouterDef> & RouterRecord;
    return typedRouter;
};

/**
 * RAG Router 类型
 * 供 webui-backend 创建类型安全的 client
 */
export type RAGRouter = ReturnType<typeof createRAGRouter>;
