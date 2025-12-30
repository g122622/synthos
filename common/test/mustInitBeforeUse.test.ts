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
import { Disposable } from "../util/lifecycle/Disposable";
import { mustInitBeforeUse } from "../util/lifecycle/mustInitBeforeUse";

// ==================== 测试用例 ====================

describe("mustInitBeforeUse 装饰器", () => {
    // 定义一个测试类
    @mustInitBeforeUse
    class TestService extends Disposable {
        public value: string = "initial";
        private _internalValue: string = "internal";

        public async init(): Promise<void> {
            this.value = "initialized";
        }

        public getValue(): string {
            return this.value;
        }

        public getInternalValue(): string {
            return this._internalValue;
        }

        public setValue(newValue: string): void {
            this.value = newValue;
        }

        public async asyncMethod(): Promise<string> {
            return "async result";
        }
    }

    // 定义一个带参数 init 的测试类
    @mustInitBeforeUse
    class TestServiceWithInitParams extends Disposable {
        public config: any = null;

        public async init(config: any): Promise<void> {
            this.config = config;
        }

        public getConfig(): any {
            return this.config;
        }
    }

    // 定义一个同步 init 的测试类
    @mustInitBeforeUse
    class TestServiceSyncInit extends Disposable {
        public initialized: boolean = false;

        public init(): void {
            this.initialized = true;
        }

        public isInitialized(): boolean {
            return this.initialized;
        }
    }

    let service: TestService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new TestService();
    });

    afterEach(async () => {
        if (!service.isDisposed) {
            await service.dispose();
        }
    });

    describe("未初始化时的行为", () => {
        it("访问普通属性应抛出错误", () => {
            expect(() => {
                const _ = service.value;
            }).toThrow(/必须在使用前调用.*init\(\)/);
        });

        it("调用普通方法应抛出错误", () => {
            expect(() => {
                service.getValue();
            }).toThrow(/必须在使用前调用.*init\(\)/);
        });

        it("错误信息应包含类名和属性名", () => {
            expect(() => {
                service.getValue();
            }).toThrow(/TestService.*getValue/);
        });
    });

    describe("豁免的方法和属性", () => {
        it("init 方法应始终可访问", async () => {
            // init 本身不应抛错
            await expect(service.init()).resolves.not.toThrow();
        });

        it("dispose 方法应始终可访问", async () => {
            await expect(service.dispose()).resolves.not.toThrow();
        });

        it("isDisposed 属性应始终可访问", () => {
            expect(() => {
                const _ = service.isDisposed;
            }).not.toThrow();
            expect(service.isDisposed).toBe(false);
        });

        it("dispose 后访问属性不应抛出初始化错误", async () => {
            await service.dispose();

            // dispose 后 isDisposed 仍可访问
            expect(service.isDisposed).toBe(true);
        });
    });

    describe("初始化后的行为", () => {
        beforeEach(async () => {
            await service.init();
        });

        it("访问普通属性应正常", () => {
            expect(service.value).toBe("initialized");
        });

        it("调用普通方法应正常", () => {
            expect(service.getValue()).toBe("initialized");
        });

        it("修改属性应正常", () => {
            service.setValue("new value");
            expect(service.getValue()).toBe("new value");
        });

        it("异步方法应正常工作", async () => {
            const result = await service.asyncMethod();
            expect(result).toBe("async result");
        });

        it("私有属性应可访问", () => {
            expect(service.getInternalValue()).toBe("internal");
        });
    });

    describe("init 方法参数支持", () => {
        it("应支持带参数的 init 方法", async () => {
            const serviceWithParams = new TestServiceWithInitParams();
            const config = { key: "value", nested: { a: 1 } };

            await serviceWithParams.init(config);

            expect(serviceWithParams.getConfig()).toEqual(config);
            await serviceWithParams.dispose();
        });
    });

    describe("同步 init 支持", () => {
        it("应支持同步 init 方法", async () => {
            const syncService = new TestServiceSyncInit();

            // 即使 init 是同步的，装饰器也会将其包装为 Promise
            await syncService.init();

            expect(syncService.isInitialized()).toBe(true);
            await syncService.dispose();
        });
    });

    describe("方法 this 绑定", () => {
        it("方法的 this 应正确绑定", async () => {
            await service.init();

            // 解构出方法
            const { getValue } = service;

            // 调用解构出的方法应正常工作（this 应正确绑定）
            expect(getValue()).toBe("initialized");
        });

        it("传递方法作为回调时 this 应正确绑定", async () => {
            await service.init();

            // 将方法作为回调传递
            const callback = service.getValue;
            const result = callback();

            expect(result).toBe("initialized");
        });
    });

    describe("多实例独立性", () => {
        it("不同实例的初始化状态应独立", async () => {
            const service1 = new TestService();
            const service2 = new TestService();

            // 只初始化 service1
            await service1.init();

            // service1 应可访问
            expect(service1.getValue()).toBe("initialized");

            // service2 未初始化，应抛错
            expect(() => {
                service2.getValue();
            }).toThrow(/必须在使用前调用/);

            await service1.dispose();
            await service2.dispose();
        });
    });

    describe("继承场景", () => {
        @mustInitBeforeUse
        class BaseService extends Disposable {
            public baseValue: string = "base";

            public async init(): Promise<void> {
                this.baseValue = "base initialized";
            }

            public getBaseValue(): string {
                return this.baseValue;
            }
        }

        // 注意：子类不需要再次添加装饰器
        class DerivedService extends BaseService {
            public derivedValue: string = "derived";

            public async init(): Promise<void> {
                await super.init();
                this.derivedValue = "derived initialized";
            }

            public getDerivedValue(): string {
                return this.derivedValue;
            }
        }

        it("继承的类应正确工作", async () => {
            const derived = new DerivedService();

            // 未初始化时应抛错
            expect(() => {
                derived.getBaseValue();
            }).toThrow(/必须在使用前调用/);

            await derived.init();

            expect(derived.getBaseValue()).toBe("base initialized");
            expect(derived.getDerivedValue()).toBe("derived initialized");

            await derived.dispose();
        });
    });

    describe("边界情况", () => {
        it("多次调用 init 应安全且只执行一次", async () => {
            await service.init();
            service.setValue("modified");

            // 再次调用 init 不会重新执行初始化逻辑
            await service.init();
            // value 应保持为 "modified"，而不是被重置为 "initialized"
            expect(service.getValue()).toBe("modified");
        });

        it("dispose 后再次初始化的行为", async () => {
            await service.init();
            await service.dispose();

            // dispose 后，isDisposed 为 true，访问属性不会抛初始化错误
            // 但属性可能已被清除
            expect(service.isDisposed).toBe(true);
        });
    });

    describe("init 幂等性", () => {
        // 用于测试初始化计数的类
        @mustInitBeforeUse
        class InitCounterService extends Disposable {
            public initCount: number = 0;

            public async init(): Promise<void> {
                this.initCount++;
                // 模拟异步操作
                await new Promise((resolve) => setTimeout(resolve, 10));
            }

            public getInitCount(): number {
                return this.initCount;
            }
        }

        it("已初始化完成后再次调用 init 应直接返回，不重复执行", async () => {
            const counter = new InitCounterService();
            
            await counter.init();
            expect(counter.getInitCount()).toBe(1);

            // 再次调用 init
            await counter.init();
            expect(counter.getInitCount()).toBe(1); // 仍然是 1，没有重复执行

            // 多次调用
            await counter.init();
            await counter.init();
            expect(counter.getInitCount()).toBe(1);

            await counter.dispose();
        });

        it("并发调用 init 应共享同一个 Promise，只执行一次初始化", async () => {
            const counter = new InitCounterService();

            // 并发调用多次 init
            const promises = [
                counter.init(),
                counter.init(),
                counter.init()
            ];

            await Promise.all(promises);

            // 只应执行一次初始化
            expect(counter.getInitCount()).toBe(1);

            await counter.dispose();
        });

        it("并发调用 init 后所有调用者都能正常使用实例", async () => {
            const counter = new InitCounterService();

            // 并发调用
            const [result1, result2, result3] = await Promise.all([
                counter.init().then(() => counter.getInitCount()),
                counter.init().then(() => counter.getInitCount()),
                counter.init().then(() => counter.getInitCount())
            ]);

            // 所有调用者都应能获取到正确的值
            expect(result1).toBe(1);
            expect(result2).toBe(1);
            expect(result3).toBe(1);

            await counter.dispose();
        });

        it("初始化失败后应允许重试", async () => {
            // 使用外部变量追踪状态，因为初始化失败后实例属性不可访问
            let initAttempts = 0;
            let shouldFail = true;

            @mustInitBeforeUse
            class RetryableInitService extends Disposable {
                public async init(): Promise<void> {
                    initAttempts++;
                    if (shouldFail) {
                        throw new Error("初始化失败");
                    }
                }

                public getValue(): string {
                    return "success";
                }
            }

            const retryService = new RetryableInitService();

            // 第一次调用应失败
            await expect(retryService.init()).rejects.toThrow("初始化失败");
            expect(initAttempts).toBe(1);

            // 设置为不再失败
            shouldFail = false;

            // 重试应成功
            await expect(retryService.init()).resolves.not.toThrow();
            expect(initAttempts).toBe(2);

            // 成功后再次调用不应重复执行
            await retryService.init();
            expect(initAttempts).toBe(2);

            // 验证初始化成功后可正常使用
            expect(retryService.getValue()).toBe("success");

            await retryService.dispose();
        });

        it("正在初始化时再次调用应等待当前初始化完成", async () => {
            const counter = new InitCounterService();
            const callOrder: string[] = [];

            // 开始初始化
            const promise1 = counter.init().then(() => {
                callOrder.push("first");
            });

            // 在初始化过程中再次调用
            const promise2 = counter.init().then(() => {
                callOrder.push("second");
            });

            await Promise.all([promise1, promise2]);

            // 两个调用都应在初始化完成后执行 then
            expect(callOrder).toHaveLength(2);
            expect(counter.getInitCount()).toBe(1);

            await counter.dispose();
        });
    });
});
