// mustInitBeforeUse.ts

import { Disposable } from "./Disposable";

/**
 * 装饰器：确保类在使用前必须调用 init() 方法（支持异步 init）
 * 赦免所有来自 Disposable 基类的方法/属性（如 dispose, isDisposed, _registerDisposable 等）
 */
export function mustInitBeforeUse<T extends new (...args: any[]) => Disposable>(constructor: T) {
    return class extends constructor {
        private _$initialized = false;

        // 赦免的方法/属性列表（包括 Disposable 基类的和额外指定的）
        private static readonly _$exemptedKeys = new Set<string | symbol>([
            // Disposable 基类的公共/保护成员（字符串形式）
            "dispose",
            "isDisposed",
            "_registerDisposable",
            "_registerDisposableFunction",
            "_isDisposed",
            // 其他可能需要赦免的
            "constructor",
            "init" // init 自身当然要赦免
            // Symbol 属性（虽然一般不会有，但安全起见可处理）
        ]);

        // 覆盖 init 方法：支持异步，标记已初始化
        async init(...args: any[]): Promise<void> {
            // 如果父类有 init（比如子类自己定义了），先调用它
            // @ts-ignore
            if (super.init && super.init !== (mustInitBeforeUse as any).prototype.init) {
                // @ts-ignore
                const result = super.init(...args);
                if (result instanceof Promise) {
                    await result;
                }
            }
            this._$initialized = true;
        }

        constructor(...args: any[]) {
            super(...args);

            return new Proxy(this, {
                get(target, prop, receiver) {
                    // 赦免规则 1：内置豁免列表
                    if (mustInitBeforeUse.prototype.constructor._$exemptedKeys.has(String(prop))) {
                        return Reflect.get(target, prop, receiver);
                    }

                    // 赦免规则 2：来自 Disposable 基类原型链上的属性（动态判断）
                    // 这样即使未来 Disposable 新增方法，也能自动豁免
                    if (
                        typeof prop === "string" &&
                        (prop in Disposable.prototype || prop === "isDisposed")
                    ) {
                        return Reflect.get(target, prop, receiver);
                    }

                    // 检查是否已初始化
                    if (!(target as any)._isDisposed && !(target as any)._$initialized) {
                        throw new Error(
                            `Class "${constructor.name}" must be initialized with await .init() before use. ` +
                                `Attempted to access property "${String(prop)}".`
                        );
                    }

                    const value = Reflect.get(target, prop, receiver);

                    // 绑定方法的 this（防止丢失）
                    if (typeof value === "function") {
                        return value.bind(target);
                    }

                    return value;
                }
            });
        }
    } as T;
}
