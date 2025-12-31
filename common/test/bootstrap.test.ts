import { describe, it, expect, beforeEach, vi } from "vitest";

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
import {
    bootstrap,
    bootstrapAll,
    getRegisteredBootstrapClasses,
    clearRegisteredBootstrapClasses
} from "../util/lifecycle/bootstrap";

// ==================== 测试用例 ====================

describe("@bootstrap 装饰器", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // 每个测试前清空已注册的类
        clearRegisteredBootstrapClasses();
    });

    describe("装饰器注册行为", () => {
        it("应正确注册被装饰的类", () => {
            @bootstrap
            class TestService {
                public main(): void {
                    // 空实现
                }
            }

            const registeredClasses = getRegisteredBootstrapClasses();
            expect(registeredClasses).toHaveLength(1);
            expect(registeredClasses[0]).toBe(TestService);
        });

        it("应支持注册多个类", () => {
            @bootstrap
            class ServiceA {
                public main(): void {}
            }

            @bootstrap
            class ServiceB {
                public main(): void {}
            }

            @bootstrap
            class ServiceC {
                public main(): void {}
            }

            const registeredClasses = getRegisteredBootstrapClasses();
            expect(registeredClasses).toHaveLength(3);
        });

        it("没有 main 方法的类应抛出错误", () => {
            expect(() => {
                // 动态创建一个没有 main 方法的类并尝试应用装饰器
                class InvalidService {
                    public doSomething(): void {}
                }
                // 手动调用装饰器函数来绕过 TypeScript 静态检查
                bootstrap(InvalidService as any);
            }).toThrow(/未实现 main\(\) 方法/);
        });
    });

    describe("bootstrapAll 执行行为", () => {
        it("应实例化并调用所有注册类的 main 方法", async () => {
            const executionOrder: string[] = [];

            @bootstrap
            class ServiceA {
                public main(): void {
                    executionOrder.push("A");
                }
            }

            @bootstrap
            class ServiceB {
                public main(): void {
                    executionOrder.push("B");
                }
            }

            await bootstrapAll();

            expect(executionOrder).toHaveLength(2);
            expect(executionOrder).toContain("A");
            expect(executionOrder).toContain("B");
        });

        it("应支持异步 main 方法", async () => {
            let asyncCompleted = false;

            @bootstrap
            class AsyncService {
                public async main(): Promise<void> {
                    await new Promise(resolve => setTimeout(resolve, 10));
                    asyncCompleted = true;
                }
            }

            await bootstrapAll();

            expect(asyncCompleted).toBe(true);
        });

        it("无注册类时应正常返回空结果", async () => {
            const result = await bootstrapAll();

            expect(result.succeeded).toHaveLength(0);
            expect(result.failed).toHaveLength(0);
            expect(mockLogger.warning).toHaveBeenCalledWith(
                expect.stringContaining("没有找到任何被 @bootstrap 装饰的类")
            );
        });

        it("应返回成功执行的类名列表", async () => {
            @bootstrap
            class ServiceA {
                public main(): void {}
            }

            @bootstrap
            class ServiceB {
                public main(): void {}
            }

            const result = await bootstrapAll();

            expect(result.succeeded).toHaveLength(2);
            expect(result.succeeded).toContain("ServiceA");
            expect(result.succeeded).toContain("ServiceB");
            expect(result.failed).toHaveLength(0);
        });
    });

    describe("failFast 模式（默认）", () => {
        it("遇到错误应立即抛出异常", async () => {
            @bootstrap
            class FailingService {
                public main(): void {
                    throw new Error("启动失败");
                }
            }

            await expect(bootstrapAll()).rejects.toThrow(/Bootstrap 失败.*FailingService/);
        });

        it("遇到错误后不应继续执行后续类", async () => {
            const executionOrder: string[] = [];

            @bootstrap
            class ServiceA {
                public main(): void {
                    executionOrder.push("A");
                    throw new Error("A 失败");
                }
            }

            @bootstrap
            class ServiceB {
                public main(): void {
                    executionOrder.push("B");
                }
            }

            try {
                await bootstrapAll();
            } catch {
                // 预期会抛出错误
            }

            expect(executionOrder).toEqual(["A"]);
            expect(executionOrder).not.toContain("B");
        });

        it("异步 main 方法的错误也应正确捕获", async () => {
            @bootstrap
            class AsyncFailingService {
                public async main(): Promise<void> {
                    await new Promise(resolve => setTimeout(resolve, 5));
                    throw new Error("异步启动失败");
                }
            }

            await expect(bootstrapAll()).rejects.toThrow(/Bootstrap 失败.*AsyncFailingService/);
        });
    });

    describe("failFast: false 模式", () => {
        it("遇到错误应继续执行后续类", async () => {
            const executionOrder: string[] = [];

            @bootstrap
            class ServiceA {
                public main(): void {
                    executionOrder.push("A");
                    throw new Error("A 失败");
                }
            }

            @bootstrap
            class ServiceB {
                public main(): void {
                    executionOrder.push("B");
                }
            }

            const result = await bootstrapAll({ failFast: false });

            expect(executionOrder).toEqual(["A", "B"]);
            expect(result.succeeded).toContain("ServiceB");
            expect(result.failed).toHaveLength(1);
            expect(result.failed[0].className).toBe("ServiceA");
        });

        it("应收集所有失败信息", async () => {
            @bootstrap
            class FailingServiceA {
                public main(): void {
                    throw new Error("错误 A");
                }
            }

            @bootstrap
            class FailingServiceB {
                public main(): void {
                    throw new Error("错误 B");
                }
            }

            @bootstrap
            class SuccessService {
                public main(): void {}
            }

            const result = await bootstrapAll({ failFast: false });

            expect(result.succeeded).toHaveLength(1);
            expect(result.succeeded).toContain("SuccessService");
            expect(result.failed).toHaveLength(2);
            expect(result.failed.map(f => f.className)).toContain("FailingServiceA");
            expect(result.failed.map(f => f.className)).toContain("FailingServiceB");
        });

        it("失败信息应包含错误详情", async () => {
            @bootstrap
            class FailingService {
                public main(): void {
                    throw new Error("具体错误信息");
                }
            }

            const result = await bootstrapAll({ failFast: false });

            expect(result.failed[0].error.message).toBe("具体错误信息");
        });
    });

    describe("日志输出", () => {
        it("应记录开始执行日志", async () => {
            @bootstrap
            class TestService {
                public main(): void {}
            }

            await bootstrapAll();

            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("开始执行"));
        });

        it("成功时应记录成功日志", async () => {
            @bootstrap
            class TestService {
                public main(): void {}
            }

            await bootstrapAll();

            expect(mockLogger.success).toHaveBeenCalledWith(expect.stringContaining("TestService"));
        });

        it("失败时应记录错误日志", async () => {
            @bootstrap
            class FailingService {
                public main(): void {
                    throw new Error("失败");
                }
            }

            try {
                await bootstrapAll();
            } catch {
                // 预期抛出错误
            }

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("FailingService")
            );
        });
    });

    describe("辅助函数", () => {
        it("getRegisteredBootstrapClasses 应返回只读副本", () => {
            @bootstrap
            class TestService {
                public main(): void {}
            }

            const classes1 = getRegisteredBootstrapClasses();
            const classes2 = getRegisteredBootstrapClasses();

            // 返回的是不同的数组实例
            expect(classes1).not.toBe(classes2);
            // 但内容相同
            expect(classes1).toEqual(classes2);
        });

        it("clearRegisteredBootstrapClasses 应清空所有注册", () => {
            @bootstrap
            class ServiceA {
                public main(): void {}
            }

            @bootstrap
            class ServiceB {
                public main(): void {}
            }

            expect(getRegisteredBootstrapClasses()).toHaveLength(2);

            clearRegisteredBootstrapClasses();

            expect(getRegisteredBootstrapClasses()).toHaveLength(0);
        });
    });

    describe("边界情况", () => {
        it("main 方法返回非 Promise 的值应正常处理", async () => {
            // 动态创建一个 main 返回非标准类型的类
            class ServiceWithReturnValue {
                public main(): string {
                    return "some value";
                }
            }
            // 手动应用装饰器，绕过 TypeScript 静态类型检查
            bootstrap(ServiceWithReturnValue as any);

            const result = await bootstrapAll();

            expect(result.succeeded).toContain("ServiceWithReturnValue");
        });

        it("非 Error 类型的异常也应正确捕获", async () => {
            @bootstrap
            class ServiceThrowingString {
                public main(): void {
                    // eslint-disable-next-line no-throw-literal
                    throw "字符串错误";
                }
            }

            const result = await bootstrapAll({ failFast: false });

            expect(result.failed).toHaveLength(1);
            expect(result.failed[0].error.message).toBe("字符串错误");
        });

        it("重复调用 bootstrapAll 应多次实例化并执行", async () => {
            let executionCount = 0;

            @bootstrap
            class CounterService {
                public main(): void {
                    executionCount++;
                }
            }

            await bootstrapAll();
            await bootstrapAll();

            // 每次 bootstrapAll 都会创建新实例并执行
            expect(executionCount).toBe(2);
        });
    });
});
