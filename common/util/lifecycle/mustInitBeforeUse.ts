// mustInitBeforeUse.ts

import { Disposable } from "./Disposable";

/**
 * 装饰器：确保类在使用前必须调用 init() 方法（支持异步 init）
 * 赦免所有来自 Disposable 基类的方法/属性（如 dispose, isDisposed, _registerDisposable 等）
 *
 * init() 方法具有幂等性：
 * - 如果已初始化完成，再次调用 init() 会直接返回
 * - 如果正在初始化，再次调用 init() 会等待当前初始化完成
 * - 如果初始化失败，允许重新调用 init() 进行重试
 */
export function mustInitBeforeUse<T extends new (...args: any[]) => Disposable>(constructor: T) {
    // 赦免的方法/属性列表（包括 Disposable 基类的和额外指定的）
    const exemptedKeys = new Set<string | symbol>([
        // Disposable 基类的公共/保护成员（字符串形式）
        "dispose",
        "isDisposed",
        "_registerDisposable",
        "_registerDisposableFunction",
        "_isDisposed",
        "_disposables", // dispose 内部会访问此属性
        // 其他可能需要赦免的
        "constructor",
        "init", // init 自身当然要赦免
        // 装饰器内部状态属性（init 方法内部需要访问）
        "_$initialized",
        "_$initializing",
        "_$initPromise",
        "_$doInit"
    ]);

    const DecoratedClass = class extends constructor {
        private _$initialized = false;
        private _$initializing = false; // 标记是否正在初始化，因为我们可能会在 init 中调用其他方法，这些方法也需要豁免
        private _$initPromise: Promise<void> | null = null; // 存储初始化 Promise，用于幂等性控制

        // 覆盖 init 方法：支持异步，标记已初始化，具有幂等性
        public async init(...args: any[]): Promise<void> {
            // 幂等性检查：如果已初始化完成，直接返回
            if (this._$initialized) {
                return;
            }

            // 幂等性检查：如果正在初始化，返回现有的 Promise（等待当前初始化完成）
            if (this._$initializing && this._$initPromise) {
                return this._$initPromise;
            }

            this._$initializing = true; // 进入初始化
            this._$initPromise = this._$doInit(args);

            try {
                await this._$initPromise;
            } catch (error) {
                // 初始化失败时，重置状态以允许重试
                this._$initializing = false;
                this._$initPromise = null;
                throw error;
            }
        }

        // 实际执行初始化逻辑的内部方法
        private async _$doInit(args: any[]): Promise<void> {
            try {
                // 如果父类有 init（比如子类自己定义了），先调用它
                // @ts-ignore
                if (super.init && super.init !== DecoratedClass.prototype.init) {
                    // @ts-ignore
                    const result = super.init(...args);
                    if (result instanceof Promise) {
                        await result;
                    }
                }
                this._$initialized = true;
            } finally {
                this._$initializing = false; // 退出初始化
            }
        }

        constructor(...args: any[]) {
            super(...args);

            return new Proxy(this, {
                get(target, prop, receiver) {
                    // 赦免规则 1：内置豁免列表
                    if (exemptedKeys.has(String(prop))) {
                        return Reflect.get(target, prop, receiver);
                    }

                    // 赦免规则 2：来自 Disposable 基类原型链上的属性（动态判断）
                    // 这样即使未来 Disposable 新增方法，也能自动豁免
                    if (typeof prop === "string" && (prop in Disposable.prototype || prop === "isDisposed")) {
                        return Reflect.get(target, prop, receiver);
                    }

                    // 检查是否已初始化
                    if (
                        !(target as any)._isDisposed &&
                        !(target as any)._$initialized &&
                        !(target as any)._$initializing
                    ) {
                        // 只有既未初始化，又不在初始化过程中，才报错
                        throw new Error(
                            `类 "${constructor.name}" 必须在使用前调用 await .init() 进行初始化。 ` +
                                `尝试访问属性 "${String(prop)}"。`
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
    };

    return DecoratedClass as T;
}
