import { CtxTemplateNode } from "../../template/CtxTemplate";

// 中间件函数类型
export type CtxMiddleware = (node: CtxTemplateNode) => CtxTemplateNode | Promise<CtxTemplateNode>;

// 依赖注入容器
export class MiddlewareContainer {
    private static instance: MiddlewareContainer;
    private registry = new Map<string | symbol, CtxMiddleware>();

    private constructor() {}

    public static getInstance(): MiddlewareContainer {
        if (!MiddlewareContainer.instance) {
            MiddlewareContainer.instance = new MiddlewareContainer();
        }

        return MiddlewareContainer.instance;
    }

    // 注册中间件
    public register(token: string | symbol, middleware: CtxMiddleware): void {
        this.registry.set(token, middleware);
    }

    // 获取中间件
    public get(token: string | symbol): CtxMiddleware | undefined {
        return this.registry.get(token);
    }
}

// 预定义中间件 Tokens
export const CTX_MIDDLEWARE_TOKENS = {
    INJECT_TIME: Symbol("inject_time"),
    ADD_BACKGROUND_KNOWLEDGE: Symbol("add_background_knowledge")
};
