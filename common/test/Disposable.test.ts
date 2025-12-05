import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ==================== Mock 区域 ====================

// 使用 vi.hoisted 来创建可以在 mock 中引用的变量
const { mockLogger } = vi.hoisted(() => ({
    mockLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
        error: vi.fn()
    }
}));

// Mock Logger
vi.mock("@root/common/util/Logger", () => ({
    default: {
        withTag: () => mockLogger
    }
}));

// 在 mock 之后导入
import { Disposable, IDisposable } from "../util/lifecycle/Disposable";

// ==================== 测试用例 ====================

describe("Disposable", () => {
    // 创建一个可测试的子类，暴露 protected 方法
    class TestDisposable extends Disposable {
        public value: string = "test";
        public disposeCount = 0;

        public registerDisposable<T extends IDisposable | null | undefined>(
            disposable: T
        ): T {
            return this._registerDisposable(disposable);
        }

        public registerDisposableFunction(func: () => Promise<void> | void): void {
            this._registerDisposableFunction(func);
        }

        // 重写 dispose 以追踪调用次数（注意：原始 Disposable 的 dispose 不允许被重写）
        // 这里我们通过注册一个函数来追踪
        public setupDisposeTracking(): void {
            this._registerDisposableFunction(() => {
                this.disposeCount++;
            });
        }
    }

    let disposable: TestDisposable;

    beforeEach(() => {
        vi.clearAllMocks();
        disposable = new TestDisposable();
    });

    afterEach(async () => {
        // 确保清理
        if (!disposable.isDisposed) {
            await disposable.dispose();
        }
    });

    describe("基本属性", () => {
        it("新创建的实例 isDisposed 应为 false", () => {
            expect(disposable.isDisposed).toBe(false);
        });

        it("dispose 后 isDisposed 应为 true", async () => {
            await disposable.dispose();
            expect(disposable.isDisposed).toBe(true);
        });
    });

    describe("_registerDisposable", () => {
        it("应成功注册可释放对象", async () => {
            const mockDisposable: IDisposable = {
                dispose: vi.fn()
            };

            const result = disposable.registerDisposable(mockDisposable);

            expect(result).toBe(mockDisposable);

            // dispose 后应调用注册对象的 dispose
            await disposable.dispose();
            expect(mockDisposable.dispose).toHaveBeenCalled();
        });

        it("注册 null 或 undefined 应返回原值且不报错", () => {
            const resultNull = disposable.registerDisposable(null);
            const resultUndefined = disposable.registerDisposable(undefined);

            expect(resultNull).toBeNull();
            expect(resultUndefined).toBeUndefined();
            expect(mockLogger.warning).toHaveBeenCalledTimes(2);
        });

        it("在已 dispose 的对象上注册应立即释放注册对象", async () => {
            await disposable.dispose();

            const mockDisposable: IDisposable = {
                dispose: vi.fn()
            };

            disposable.registerDisposable(mockDisposable);

            expect(mockDisposable.dispose).toHaveBeenCalled();
            expect(mockLogger.warning).toHaveBeenCalled();
        });

        it("不允许注册自身（循环引用）", () => {
            expect(() => {
                disposable.registerDisposable(disposable);
            }).toThrow("CYCLIC_REFERENCE_ERROR");
        });

        it("注册多个可释放对象，dispose 时应全部释放", async () => {
            const mockDisposable1: IDisposable = { dispose: vi.fn() };
            const mockDisposable2: IDisposable = { dispose: vi.fn() };
            const mockDisposable3: IDisposable = { dispose: vi.fn() };

            disposable.registerDisposable(mockDisposable1);
            disposable.registerDisposable(mockDisposable2);
            disposable.registerDisposable(mockDisposable3);

            await disposable.dispose();

            expect(mockDisposable1.dispose).toHaveBeenCalled();
            expect(mockDisposable2.dispose).toHaveBeenCalled();
            expect(mockDisposable3.dispose).toHaveBeenCalled();
        });
    });

    describe("_registerDisposableFunction", () => {
        it("应成功注册释放函数", async () => {
            const disposeFunc = vi.fn();

            disposable.registerDisposableFunction(disposeFunc);

            await disposable.dispose();
            expect(disposeFunc).toHaveBeenCalled();
        });

        it("应支持异步释放函数", async () => {
            let asyncExecuted = false;
            const asyncDisposeFunc = vi.fn(async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                asyncExecuted = true;
            });

            disposable.registerDisposableFunction(asyncDisposeFunc);

            await disposable.dispose();
            expect(asyncDisposeFunc).toHaveBeenCalled();
            expect(asyncExecuted).toBe(true);
        });
    });

    describe("dispose", () => {
        it("多次调用 dispose 应安全（幂等）", async () => {
            await disposable.dispose();
            await disposable.dispose();
            await disposable.dispose();

            expect(disposable.isDisposed).toBe(true);
        });

        it("dispose 应处理异步释放函数的错误", async () => {
            const errorFunc = vi.fn(async () => {
                throw new Error("Test error");
            });

            disposable.registerDisposableFunction(errorFunc);

            // 不应抛出错误
            await expect(disposable.dispose()).resolves.not.toThrow();
            expect(disposable.isDisposed).toBe(true);
        });

        it("dispose 应处理同步释放函数的错误", async () => {
            const errorFunc = vi.fn(() => {
                throw new Error("Test error");
            });

            disposable.registerDisposableFunction(errorFunc);

            // 不应抛出错误
            await expect(disposable.dispose()).resolves.not.toThrow();
            expect(disposable.isDisposed).toBe(true);
        });

        it("dispose 后属性应被清除（除了 _isDisposed）", async () => {
            disposable.value = "should be cleared";

            await disposable.dispose();

            // 属性应被清除
            expect((disposable as any).value).toBeUndefined();
            expect(disposable.isDisposed).toBe(true);
        });
    });

    describe("子对象层级管理", () => {
        it("注册子 Disposable 后，子对象不再是根对象", async () => {
            const parent = new TestDisposable();
            const child = new TestDisposable();

            // 注册 child 为 parent 的子对象
            parent.registerDisposable(child);

            // 释放 parent 应该同时释放 child
            await parent.dispose();

            expect(parent.isDisposed).toBe(true);
            expect(child.isDisposed).toBe(true);
        });

        it("父对象 dispose 应递归释放所有子对象", async () => {
            const grandparent = new TestDisposable();
            const parent = new TestDisposable();
            const child = new TestDisposable();

            grandparent.registerDisposable(parent);
            parent.registerDisposable(child);

            await grandparent.dispose();

            expect(grandparent.isDisposed).toBe(true);
            expect(parent.isDisposed).toBe(true);
            expect(child.isDisposed).toBe(true);
        });
    });

    describe("混合释放类型", () => {
        it("应同时处理 IDisposable 对象和函数", async () => {
            const mockDisposable: IDisposable = { dispose: vi.fn() };
            const disposeFunc = vi.fn();

            disposable.registerDisposable(mockDisposable);
            disposable.registerDisposableFunction(disposeFunc);

            await disposable.dispose();

            expect(mockDisposable.dispose).toHaveBeenCalled();
            expect(disposeFunc).toHaveBeenCalled();
        });
    });
});

