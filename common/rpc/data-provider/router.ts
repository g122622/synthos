/**
 * Data Provider RPC Router
 * 定义 tRPC router 工厂函数，供 data-provider 实现、orchestrator 调用
 */
import { initTRPC, type AnyRootConfig, type DefaultErrorShape, type Router } from "@trpc/server";

import { ProvideDataInputSchema, ProvideDataOutputSchema, ProvideDataOutput } from "./schemas";

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
 * Data Provider RPC 实现接口
 * data-provider 需要实现这些方法
 */
export interface DataProviderRPCImplementation {
    /**
     * 数据提供
     * 从 IM 平台拉取消息并落库
     * @param input 数据提供输入
     * @returns 数据提供结果
     */
    provideData(input: {
        IMType: "QQ" | "WeChat";
        groupIds: string[];
        startTimeStamp: number;
        endTimeStamp: number;
    }): Promise<ProvideDataOutput>;
}

/**
 * 创建 Data Provider tRPC Router
 * @param impl RPC 方法的具体实现
 * @returns tRPC router 实例
 */
export const createDataProviderRouter = (impl: DataProviderRPCImplementation) => {
    const router = t.router({
        provideData: t.procedure.input(ProvideDataInputSchema).mutation(async ({ input }) => {
            // tRPC v10 + zod 3.25 在非 strictNullChecks 下会把 input 推断为 Partial，
            // 这里复用实现接口的入参类型做一次类型断言，保证跨包 .d.ts 与实现端一致。
            return impl.provideData(input as Parameters<DataProviderRPCImplementation["provideData"]>[0]);
        })
    });

    // 将 _config 放宽到 AnyRootConfig，便于跨包消费（如 orchestrator 客户端）
    type RouterRecord = (typeof router._def)["record"];
    type DataProviderRouterDef = {
        _config: AnyRootConfig;
        router: true;
        procedures: (typeof router._def)["procedures"];
        record: RouterRecord;
        queries: (typeof router._def)["queries"];
        mutations: (typeof router._def)["mutations"];
        subscriptions: (typeof router._def)["subscriptions"];
    };

    const typedRouter = router as unknown as Router<DataProviderRouterDef> & RouterRecord;

    return typedRouter;
};

/**
 * Data Provider Router 类型
 * 供 orchestrator 创建类型安全的 client
 */
export type DataProviderRouter = ReturnType<typeof createDataProviderRouter>;

// 保持 ProvideDataOutputSchema 被引用，避免未使用告警（输出类型供 impl 端显式标注）
export { ProvideDataOutputSchema };
