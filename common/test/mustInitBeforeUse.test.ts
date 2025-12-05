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
            }).toThrow(/must be initialized with await .init\(\) before use/);
        });

        it("调用普通方法应抛出错误", () => {
            expect(() => {
                service.getValue();
            }).toThrow(/must be initialized with await .init\(\) before use/);
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
            }).toThrow(/must be initialized/);

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
            }).toThrow(/must be initialized/);

            await derived.init();

            expect(derived.getBaseValue()).toBe("base initialized");
            expect(derived.getDerivedValue()).toBe("derived initialized");

            await derived.dispose();
        });
    });

    describe("边界情况", () => {
        it("多次调用 init 应安全", async () => {
            await service.init();
            service.setValue("first");

            await service.init();
            // init 会重置 value
            expect(service.getValue()).toBe("initialized");
        });

        it("dispose 后再次初始化的行为", async () => {
            await service.init();
            await service.dispose();

            // dispose 后，isDisposed 为 true，访问属性不会抛初始化错误
            // 但属性可能已被清除
            expect(service.isDisposed).toBe(true);
        });
    });
});
