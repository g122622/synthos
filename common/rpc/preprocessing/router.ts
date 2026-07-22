/**
 * Preprocessing RPC Router
 * 定义 tRPC router 工厂函数，供 preprocessing 实现、orchestrator 调用
 */
import { initTRPC, type AnyRootConfig, type DefaultErrorShape, type Router } from "@trpc/server";

import { PreprocessInputSchema, PreprocessOutput, PreprocessOutputSchema } from "./schemas";

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
 * Preprocessing RPC 实现接口
 * preprocessing 需要实现这些方法
 */
export interface PreprocessingRPCImplementation {
    /**
     * 预处理
     * 对消息进行分割和预处理并落库
     * @param input 预处理输入
     * @returns 预处理结果
     */
    preprocess(input: {
        groupIds: string[];
        startTimeStamp: number;
        endTimeStamp: number;
    }): Promise<PreprocessOutput>;
}

/**
 * 创建 Preprocessing tRPC Router
 * @param impl RPC 方法的具体实现
 * @returns tRPC router 实例
 */
export const createPreprocessingRouter = (impl: PreprocessingRPCImplementation) => {
    const router = t.router({
        preprocess: t.procedure.input(PreprocessInputSchema).mutation(async ({ input }) => {
            // tRPC v10 + zod 3.25 在非 strictNullChecks 下会把 input 推断为 Partial，
            // 这里复用实现接口的入参类型做一次类型断言，保证跨包 .d.ts 与实现端一致。
            return impl.preprocess(input as Parameters<PreprocessingRPCImplementation["preprocess"]>[0]);
        })
    });

    // 将 _config 放宽到 AnyRootConfig，便于跨包消费（如 orchestrator 客户端）
    type RouterRecord = (typeof router._def)["record"];
    type PreprocessingRouterDef = {
        _config: AnyRootConfig;
        router: true;
        procedures: (typeof router._def)["procedures"];
        record: RouterRecord;
        queries: (typeof router._def)["queries"];
        mutations: (typeof router._def)["mutations"];
        subscriptions: (typeof router._def)["subscriptions"];
    };

    const typedRouter = router as unknown as Router<PreprocessingRouterDef> & RouterRecord;

    return typedRouter;
};

/**
 * Preprocessing Router 类型
 * 供 orchestrator 创建类型安全的 client
 */
export type PreprocessingRouter = ReturnType<typeof createPreprocessingRouter>;

// 保持 PreprocessOutputSchema 被引用，避免未使用告警（输出类型供 impl 端显式标注）
export { PreprocessOutputSchema };
