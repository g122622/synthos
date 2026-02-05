import Logger from "@root/common/util/Logger";

import { CtxTemplateNode } from "../template/CtxTemplate";

import { MiddlewareContainer } from "./container/container";

/**
 * 中间件装饰器工厂
 * @param token 中间件标识符 (e.g., CTX_MIDDLEWARE_TOKENS.ADD_WATERMARK)
 */
export function useMiddleware(token: string | symbol) {
    return (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) => {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            // 1. 执行原始方法获取结果
            let result: CtxTemplateNode = originalMethod.apply(this, args);

            // 2. 处理异步结果（如果原始方法返回 Promise）
            if (result instanceof Promise) {
                result = await result;
            }

            // 3. 从容器获取中间件
            const middleware = MiddlewareContainer.getInstance().get(token);

            if (!middleware) {
                Logger.warning(`[Middleware] Token "${String(token)}" not registered`);

                return result;
            }

            // 4. 应用中间件修改结果
            return middleware(result);
        };

        return descriptor;
    };
}
