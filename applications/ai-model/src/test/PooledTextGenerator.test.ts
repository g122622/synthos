// tests/PooledTextGenerator.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PooledTextGenerator, PooledTask, PooledTaskResult } from "../generators/text/PooledTextGenerator";

// Mock Logger
vi.mock("@root/common/util/Logger", () => {
    return {
        default: {
            withTag: () => ({
                debug: vi.fn(),
                info: vi.fn(),
                warning: vi.fn(),
                error: vi.fn(),
                success: vi.fn()
            })
        }
    };
});

// 模拟延迟函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 用于追踪并发执行数
let currentConcurrency = 0;
let maxObservedConcurrency = 0;
let totalCalls = 0;
// 用于追踪调用顺序
let callOrder: string[] = [];

// Mock TextGenerator
vi.mock("../generators/text/TextGenerator", () => {
    return {
        TextGenerator: class MockTextGenerator {
            public async init(): Promise<void> {
                // 初始化不需要实际逻辑
            }

            public dispose(): void {
                // 清理不需要实际逻辑
            }

            public async generateTextWithModelCandidates(
                modelNames: string[],
                input: string
            ): Promise<{ content: string; selectedModelName: string }> {
                currentConcurrency++;
                totalCalls++;
                callOrder.push(`start:${input}`);
                maxObservedConcurrency = Math.max(maxObservedConcurrency, currentConcurrency);

                // 根据输入模拟不同延迟
                const delayTime = input.includes("SLOW") ? 100 : 50;
                await delay(delayTime);

                currentConcurrency--;
                callOrder.push(`end:${input}`);

                // 模拟错误场景
                if (input.includes("ERROR")) {
                    throw new Error("模拟生成错误");
                }

                // 模拟超时场景
                if (input.includes("TIMEOUT")) {
                    throw new Error("Request timeout");
                }

                return {
                    content: `生成结果: ${input}`,
                    selectedModelName: modelNames[0]
                };
            }
        }
    };
});

describe("PooledTextGenerator", () => {
    let generator: PooledTextGenerator;

    beforeEach(() => {
        // 重置追踪变量
        currentConcurrency = 0;
        maxObservedConcurrency = 0;
        totalCalls = 0;
        callOrder = [];
    });

    afterEach(() => {
        if (generator) {
            generator.dispose();
        }
    });

    describe("构造函数", () => {
        it("应该在 maxConcurrency <= 0 时抛出错误", () => {
            expect(() => new PooledTextGenerator(0)).toThrow("maxConcurrency must be greater than 0");
            expect(() => new PooledTextGenerator(-1)).toThrow("maxConcurrency must be greater than 0");
        });

        it("应该成功创建实例当 maxConcurrency > 0", () => {
            generator = new PooledTextGenerator(5);
            expect(generator).toBeInstanceOf(PooledTextGenerator);
        });

        it("应该支持 maxConcurrency = 1（串行执行）", () => {
            generator = new PooledTextGenerator(1);
            expect(generator).toBeInstanceOf(PooledTextGenerator);
        });

        it("应该支持非常大的 maxConcurrency", () => {
            generator = new PooledTextGenerator(1000);
            expect(generator).toBeInstanceOf(PooledTextGenerator);
        });

        it("应该在 maxConcurrency 为小数时正常处理", () => {
            // JavaScript 不会自动截断小数，但构造函数应该能接受
            generator = new PooledTextGenerator(2.9);
            expect(generator).toBeInstanceOf(PooledTextGenerator);
        });
    });

    describe("init", () => {
        it("应该成功初始化", async () => {
            generator = new PooledTextGenerator(3);
            await expect(generator.init()).resolves.not.toThrow();
        });

        it("应该支持多次初始化（幂等性）", async () => {
            generator = new PooledTextGenerator(3);
            await generator.init();
            // 第二次初始化不应抛出错误
            await expect(generator.init()).resolves.not.toThrow();
        });
    });

    describe("generateTextWithModelCandidates", () => {
        beforeEach(async () => {
            generator = new PooledTextGenerator(3);
            await generator.init();
        });

        it("应该返回与输入数量相同的结果", async () => {
            const inputs = ["input1", "input2", "input3"];
            const modelNames = ["model1", "model2"];

            const results = await generator.generateTextWithModelCandidates(modelNames, inputs);

            expect(results.length).toBe(3);
            results.forEach((result, index) => {
                expect(result.inputIndex).toBe(index);
            });
        });

        it("应该在成功时返回正确的结果", async () => {
            const inputs = ["hello"];
            const modelNames = ["model1"];

            const results = await generator.generateTextWithModelCandidates(modelNames, inputs);

            expect(results[0].isSuccess).toBe(true);
            expect(results[0].content).toBe("生成结果: hello");
            expect(results[0].selectedModelName).toBe("model1");
        });

        it("应该在任务失败时返回错误信息", async () => {
            const inputs = ["ERROR_input"];
            const modelNames = ["model1"];

            const results = await generator.generateTextWithModelCandidates(modelNames, inputs);

            expect(results[0].isSuccess).toBe(false);
            expect(results[0].error).toBeDefined();
        });

        it("应该控制并发数不超过 maxConcurrency", async () => {
            generator = new PooledTextGenerator(2);
            await generator.init();

            const inputs = ["a", "b", "c", "d", "e"];
            const modelNames = ["model1"];

            await generator.generateTextWithModelCandidates(modelNames, inputs);

            expect(maxObservedConcurrency).toBeLessThanOrEqual(2);
            expect(totalCalls).toBe(5);
        });

        it("应该处理空输入数组", async () => {
            const inputs: string[] = [];
            const modelNames = ["model1"];

            const results = await generator.generateTextWithModelCandidates(modelNames, inputs);

            expect(results.length).toBe(0);
        });

        it("应该处理单个输入", async () => {
            const inputs = ["single"];
            const modelNames = ["model1"];

            const results = await generator.generateTextWithModelCandidates(modelNames, inputs);

            expect(results.length).toBe(1);
            expect(results[0].isSuccess).toBe(true);
            expect(results[0].inputIndex).toBe(0);
        });

        it("应该保持结果与输入的索引对应关系", async () => {
            const inputs = ["first", "second", "third", "fourth", "fifth"];
            const modelNames = ["model1"];

            const results = await generator.generateTextWithModelCandidates(modelNames, inputs);

            for (let i = 0; i < inputs.length; i++) {
                expect(results[i].inputIndex).toBe(i);
                expect(results[i].content).toBe(`生成结果: ${inputs[i]}`);
            }
        });

        it("应该处理混合成功和失败的输入", async () => {
            const inputs = ["success1", "ERROR_1", "success2", "ERROR_2", "success3"];
            const modelNames = ["model1"];

            const results = await generator.generateTextWithModelCandidates(modelNames, inputs);

            expect(results[0].isSuccess).toBe(true);
            expect(results[1].isSuccess).toBe(false);
            expect(results[2].isSuccess).toBe(true);
            expect(results[3].isSuccess).toBe(false);
            expect(results[4].isSuccess).toBe(true);
        });

        it("应该在 maxConcurrency=1 时串行执行", async () => {
            generator = new PooledTextGenerator(1);
            await generator.init();

            const inputs = ["a", "b", "c"];
            const modelNames = ["model1"];

            await generator.generateTextWithModelCandidates(modelNames, inputs);

            // 串行执行时，最大并发应该始终为 1
            expect(maxObservedConcurrency).toBe(1);

            // 验证串行顺序：每个任务应该在前一个结束后才开始
            expect(callOrder[0]).toBe("start:a");
            expect(callOrder[1]).toBe("end:a");
            expect(callOrder[2]).toBe("start:b");
            expect(callOrder[3]).toBe("end:b");
            expect(callOrder[4]).toBe("start:c");
            expect(callOrder[5]).toBe("end:c");
        });

        it("应该处理大量输入（压力测试）", async () => {
            generator = new PooledTextGenerator(5);
            await generator.init();

            const inputs = Array.from({ length: 50 }, (_, i) => `input_${i}`);
            const modelNames = ["model1"];

            const results = await generator.generateTextWithModelCandidates(modelNames, inputs);

            expect(results.length).toBe(50);
            expect(maxObservedConcurrency).toBeLessThanOrEqual(5);
            expect(totalCalls).toBe(50);

            // 验证所有结果都成功
            results.forEach(result => {
                expect(result.isSuccess).toBe(true);
            });
        });

        it("应该使用多个模型候选时返回第一个模型名", async () => {
            const inputs = ["test"];
            const modelNames = ["primary-model", "fallback-model", "backup-model"];

            const results = await generator.generateTextWithModelCandidates(modelNames, inputs);

            expect(results[0].selectedModelName).toBe("primary-model");
        });

        it("应该能连续多次调用", async () => {
            const modelNames = ["model1"];

            // 第一次调用
            const results1 = await generator.generateTextWithModelCandidates(modelNames, ["batch1_a", "batch1_b"]);
            expect(results1.length).toBe(2);

            // 第二次调用
            const results2 = await generator.generateTextWithModelCandidates(modelNames, [
                "batch2_a",
                "batch2_b",
                "batch2_c"
            ]);
            expect(results2.length).toBe(3);

            // 验证总调用次数
            expect(totalCalls).toBe(5);
        });
    });

    describe("submitTasks", () => {
        beforeEach(async () => {
            generator = new PooledTextGenerator(3);
            await generator.init();
        });

        it("应该为每个任务调用回调函数", async () => {
            interface TestContext {
                id: number;
            }

            const tasks: PooledTask<TestContext>[] = [
                { input: "task1", modelNames: ["model1"], context: { id: 1 } },
                { input: "task2", modelNames: ["model1"], context: { id: 2 } },
                { input: "task3", modelNames: ["model1"], context: { id: 3 } }
            ];

            const results: PooledTaskResult<TestContext>[] = [];

            await generator.submitTasks<TestContext>(tasks, result => {
                results.push(result);
            });

            expect(results.length).toBe(3);
            // 验证所有上下文都被正确传递
            const ids = results.map(r => r.context.id).sort();
            expect(ids).toEqual([1, 2, 3]);
        });

        it("应该在任务完成时立即回调（而非等待所有任务完成）", async () => {
            interface TestContext {
                order: number;
            }

            const tasks: PooledTask<TestContext>[] = [
                { input: "a", modelNames: ["model1"], context: { order: 1 } },
                { input: "b", modelNames: ["model1"], context: { order: 2 } }
            ];

            const callbackTimes: number[] = [];
            const startTime = Date.now();

            await generator.submitTasks<TestContext>(tasks, () => {
                callbackTimes.push(Date.now() - startTime);
            });

            // 由于并发执行，回调时间应该相近，而不是串行的
            expect(callbackTimes.length).toBe(2);
        });

        it("应该正确处理失败的任务", async () => {
            interface TestContext {
                name: string;
            }

            const tasks: PooledTask<TestContext>[] = [
                { input: "success", modelNames: ["model1"], context: { name: "success_task" } },
                { input: "ERROR_fail", modelNames: ["model1"], context: { name: "fail_task" } }
            ];

            const results: PooledTaskResult<TestContext>[] = [];

            await generator.submitTasks<TestContext>(tasks, result => {
                results.push(result);
            });

            const successResult = results.find(r => r.context.name === "success_task");
            const failResult = results.find(r => r.context.name === "fail_task");

            expect(successResult?.isSuccess).toBe(true);
            expect(successResult?.content).toBe("生成结果: success");

            expect(failResult?.isSuccess).toBe(false);
            expect(failResult?.error).toBeDefined();
        });

        it("应该允许每个任务使用不同的模型候选列表", async () => {
            interface TestContext {
                taskId: string;
            }

            const tasks: PooledTask<TestContext>[] = [
                { input: "task1", modelNames: ["modelA"], context: { taskId: "t1" } },
                { input: "task2", modelNames: ["modelB"], context: { taskId: "t2" } }
            ];

            const results: PooledTaskResult<TestContext>[] = [];

            await generator.submitTasks<TestContext>(tasks, result => {
                results.push(result);
            });

            const t1Result = results.find(r => r.context.taskId === "t1");
            const t2Result = results.find(r => r.context.taskId === "t2");

            expect(t1Result?.selectedModelName).toBe("modelA");
            expect(t2Result?.selectedModelName).toBe("modelB");
        });

        it("应该控制并发数不超过 maxConcurrency", async () => {
            generator = new PooledTextGenerator(2);
            await generator.init();

            interface TestContext {
                index: number;
            }

            const tasks: PooledTask<TestContext>[] = Array.from({ length: 6 }, (_, i) => ({
                input: `task${i}`,
                modelNames: ["model1"],
                context: { index: i }
            }));

            await generator.submitTasks<TestContext>(tasks, () => {
                // 空回调
            });

            expect(maxObservedConcurrency).toBeLessThanOrEqual(2);
            expect(totalCalls).toBe(6);
        });

        it("应该处理空任务数组", async () => {
            const tasks: PooledTask<{ id: number }>[] = [];
            let callbackCount = 0;

            await generator.submitTasks(tasks, () => {
                callbackCount++;
            });

            expect(callbackCount).toBe(0);
        });

        it("应该在回调函数抛出错误时不中断其他任务", async () => {
            interface TestContext {
                shouldThrow: boolean;
            }

            const tasks: PooledTask<TestContext>[] = [
                { input: "a", modelNames: ["model1"], context: { shouldThrow: true } },
                { input: "b", modelNames: ["model1"], context: { shouldThrow: false } },
                { input: "c", modelNames: ["model1"], context: { shouldThrow: false } }
            ];

            let successCallbacks = 0;

            await generator.submitTasks<TestContext>(tasks, result => {
                if (result.context.shouldThrow) {
                    throw new Error("回调错误");
                }
                successCallbacks++;
            });

            // 即使一个回调抛出错误，其他任务应该继续执行
            expect(successCallbacks).toBe(2);
        });

        it("应该支持异步回调函数", async () => {
            interface TestContext {
                id: number;
            }

            const tasks: PooledTask<TestContext>[] = [
                { input: "task1", modelNames: ["model1"], context: { id: 1 } },
                { input: "task2", modelNames: ["model1"], context: { id: 2 } }
            ];

            const processedIds: number[] = [];

            await generator.submitTasks<TestContext>(tasks, async result => {
                await delay(10); // 模拟异步操作
                processedIds.push(result.context.id);
            });

            expect(processedIds.length).toBe(2);
            expect(processedIds.sort()).toEqual([1, 2]);
        });

        it("应该支持复杂的上下文类型", async () => {
            interface ComplexContext {
                sessionId: string;
                groupId: string;
                metadata: {
                    priority: number;
                    tags: string[];
                    createdAt: Date;
                };
                callback?: () => void;
            }

            const now = new Date();
            const tasks: PooledTask<ComplexContext>[] = [
                {
                    input: "complex_task",
                    modelNames: ["model1"],
                    context: {
                        sessionId: "sess-123",
                        groupId: "grp-456",
                        metadata: {
                            priority: 1,
                            tags: ["urgent", "vip"],
                            createdAt: now
                        }
                    }
                }
            ];

            let capturedContext: ComplexContext | null = null;

            await generator.submitTasks<ComplexContext>(tasks, result => {
                capturedContext = result.context;
            });

            expect(capturedContext).not.toBeNull();
            expect(capturedContext!.sessionId).toBe("sess-123");
            expect(capturedContext!.groupId).toBe("grp-456");
            expect(capturedContext!.metadata.priority).toBe(1);
            expect(capturedContext!.metadata.tags).toEqual(["urgent", "vip"]);
            expect(capturedContext!.metadata.createdAt).toBe(now);
        });

        it("应该支持单个任务", async () => {
            interface TestContext {
                single: boolean;
            }

            const tasks: PooledTask<TestContext>[] = [
                { input: "only_one", modelNames: ["model1"], context: { single: true } }
            ];

            const results: PooledTaskResult<TestContext>[] = [];

            await generator.submitTasks<TestContext>(tasks, result => {
                results.push(result);
            });

            expect(results.length).toBe(1);
            expect(results[0].isSuccess).toBe(true);
            expect(results[0].context.single).toBe(true);
        });

        it("应该处理大量任务（压力测试）", async () => {
            generator = new PooledTextGenerator(5);
            await generator.init();

            interface TestContext {
                index: number;
            }

            const tasks: PooledTask<TestContext>[] = Array.from({ length: 100 }, (_, i) => ({
                input: `stress_${i}`,
                modelNames: ["model1"],
                context: { index: i }
            }));

            const results: PooledTaskResult<TestContext>[] = [];

            await generator.submitTasks<TestContext>(tasks, result => {
                results.push(result);
            });

            expect(results.length).toBe(100);
            expect(maxObservedConcurrency).toBeLessThanOrEqual(5);
            expect(totalCalls).toBe(100);

            // 验证所有上下文索引都存在
            const indices = results.map(r => r.context.index).sort((a, b) => a - b);
            expect(indices).toEqual(Array.from({ length: 100 }, (_, i) => i));
        });

        it("应该在 maxConcurrency=1 时串行执行回调", async () => {
            generator = new PooledTextGenerator(1);
            await generator.init();

            interface TestContext {
                order: number;
            }

            const tasks: PooledTask<TestContext>[] = [
                { input: "first", modelNames: ["model1"], context: { order: 1 } },
                { input: "second", modelNames: ["model1"], context: { order: 2 } },
                { input: "third", modelNames: ["model1"], context: { order: 3 } }
            ];

            const callbackOrder: number[] = [];

            await generator.submitTasks<TestContext>(tasks, result => {
                callbackOrder.push(result.context.order);
            });

            // 串行执行时，回调顺序应该与任务提交顺序一致
            expect(callbackOrder).toEqual([1, 2, 3]);
        });

        it("应该能连续多次调用 submitTasks", async () => {
            interface TestContext {
                batch: number;
                id: number;
            }

            // 第一批任务
            const batch1Results: PooledTaskResult<TestContext>[] = [];
            await generator.submitTasks<TestContext>(
                [
                    { input: "b1_a", modelNames: ["model1"], context: { batch: 1, id: 1 } },
                    { input: "b1_b", modelNames: ["model1"], context: { batch: 1, id: 2 } }
                ],
                result => {
                    batch1Results.push(result);
                }
            );

            // 第二批任务
            const batch2Results: PooledTaskResult<TestContext>[] = [];
            await generator.submitTasks<TestContext>(
                [
                    { input: "b2_a", modelNames: ["model1"], context: { batch: 2, id: 1 } },
                    { input: "b2_b", modelNames: ["model1"], context: { batch: 2, id: 2 } },
                    { input: "b2_c", modelNames: ["model1"], context: { batch: 2, id: 3 } }
                ],
                result => {
                    batch2Results.push(result);
                }
            );

            expect(batch1Results.length).toBe(2);
            expect(batch2Results.length).toBe(3);
            expect(batch1Results.every(r => r.context.batch === 1)).toBe(true);
            expect(batch2Results.every(r => r.context.batch === 2)).toBe(true);
        });

        it("应该处理全部失败的任务", async () => {
            interface TestContext {
                id: number;
            }

            const tasks: PooledTask<TestContext>[] = [
                { input: "ERROR_1", modelNames: ["model1"], context: { id: 1 } },
                { input: "ERROR_2", modelNames: ["model1"], context: { id: 2 } },
                { input: "ERROR_3", modelNames: ["model1"], context: { id: 3 } }
            ];

            const results: PooledTaskResult<TestContext>[] = [];

            await generator.submitTasks<TestContext>(tasks, result => {
                results.push(result);
            });

            expect(results.length).toBe(3);
            expect(results.every(r => r.isSuccess === false)).toBe(true);
            expect(results.every(r => r.error !== undefined)).toBe(true);
        });

        it("应该正确处理不同类型的错误", async () => {
            interface TestContext {
                errorType: string;
            }

            const tasks: PooledTask<TestContext>[] = [
                { input: "ERROR_standard", modelNames: ["model1"], context: { errorType: "error" } },
                { input: "TIMEOUT_test", modelNames: ["model1"], context: { errorType: "timeout" } }
            ];

            const results: PooledTaskResult<TestContext>[] = [];

            await generator.submitTasks<TestContext>(tasks, result => {
                results.push(result);
            });

            const errorResult = results.find(r => r.context.errorType === "error");
            const timeoutResult = results.find(r => r.context.errorType === "timeout");

            expect(errorResult?.isSuccess).toBe(false);
            expect(timeoutResult?.isSuccess).toBe(false);
        });

        it("应该在高并发下正确维护上下文隔离", async () => {
            generator = new PooledTextGenerator(10);
            await generator.init();

            interface TestContext {
                uniqueId: string;
                timestamp: number;
            }

            const tasks: PooledTask<TestContext>[] = Array.from({ length: 20 }, (_, i) => ({
                input: `isolation_${i}`,
                modelNames: ["model1"],
                context: {
                    uniqueId: `uid-${i}-${Math.random()}`,
                    timestamp: Date.now() + i
                }
            }));

            const contextMap = new Map<string, TestContext>();

            await generator.submitTasks<TestContext>(tasks, result => {
                // 确保上下文没有被混淆
                expect(contextMap.has(result.context.uniqueId)).toBe(false);
                contextMap.set(result.context.uniqueId, result.context);
            });

            expect(contextMap.size).toBe(20);
        });

        it("应该支持 null 和 undefined 作为上下文属性", async () => {
            interface TestContext {
                required: string;
                optional?: string;
                nullable: string | null;
            }

            const tasks: PooledTask<TestContext>[] = [
                {
                    input: "nullable_test",
                    modelNames: ["model1"],
                    context: {
                        required: "value",
                        optional: undefined,
                        nullable: null
                    }
                }
            ];

            let capturedContext: TestContext | null = null;

            await generator.submitTasks<TestContext>(tasks, result => {
                capturedContext = result.context;
            });

            expect(capturedContext).not.toBeNull();
            expect(capturedContext!.required).toBe("value");
            expect(capturedContext!.optional).toBeUndefined();
            expect(capturedContext!.nullable).toBeNull();
        });
    });

    describe("dispose", () => {
        it("应该清理资源", async () => {
            generator = new PooledTextGenerator(3);
            await generator.init();

            // dispose 不应该抛出错误
            expect(() => generator.dispose()).not.toThrow();
        });

        it("应该支持多次调用 dispose", async () => {
            generator = new PooledTextGenerator(3);
            await generator.init();

            generator.dispose();
            // 第二次 dispose 不应该抛出错误
            expect(() => generator.dispose()).not.toThrow();
        });
    });

    describe("并发控制精确性", () => {
        it("应该在任务完成后立即释放槽位", async () => {
            generator = new PooledTextGenerator(2);
            await generator.init();

            // 使用不同延迟的任务来验证槽位释放
            const inputs = ["SLOW_a", "fast_b", "fast_c", "SLOW_d"];
            const modelNames = ["model1"];

            await generator.generateTextWithModelCandidates(modelNames, inputs);

            // 所有任务都应该完成
            expect(totalCalls).toBe(4);
            expect(maxObservedConcurrency).toBeLessThanOrEqual(2);
        });

        it("应该正确处理并发边界情况", async () => {
            // 测试恰好等于 maxConcurrency 的任务数
            generator = new PooledTextGenerator(3);
            await generator.init();

            const inputs = ["a", "b", "c"]; // 恰好 3 个
            const modelNames = ["model1"];

            await generator.generateTextWithModelCandidates(modelNames, inputs);

            expect(totalCalls).toBe(3);
            // 应该能达到最大并发
            expect(maxObservedConcurrency).toBe(3);
        });

        it("应该在 maxConcurrency 大于任务数时正确运行", async () => {
            generator = new PooledTextGenerator(10);
            await generator.init();

            const inputs = ["a", "b", "c"]; // 只有 3 个任务，但 maxConcurrency=10
            const modelNames = ["model1"];

            await generator.generateTextWithModelCandidates(modelNames, inputs);

            expect(totalCalls).toBe(3);
            expect(maxObservedConcurrency).toBe(3); // 实际并发应该等于任务数
        });
    });

    describe("错误恢复", () => {
        it("应该在部分任务失败后继续执行其他任务", async () => {
            generator = new PooledTextGenerator(2);
            await generator.init();

            const inputs = ["ok1", "ERROR_fail", "ok2", "ERROR_fail2", "ok3"];
            const modelNames = ["model1"];

            const results = await generator.generateTextWithModelCandidates(modelNames, inputs);

            expect(results.length).toBe(5);
            expect(results.filter(r => r.isSuccess).length).toBe(3);
            expect(results.filter(r => !r.isSuccess).length).toBe(2);
        });

        it("应该在 submitTasks 中正确隔离失败任务", async () => {
            interface TestContext {
                id: number;
            }

            const tasks: PooledTask<TestContext>[] = [
                { input: "ok", modelNames: ["model1"], context: { id: 1 } },
                { input: "ERROR_fail", modelNames: ["model1"], context: { id: 2 } },
                { input: "ok", modelNames: ["model1"], context: { id: 3 } }
            ];

            const successResults: number[] = [];
            const failResults: number[] = [];

            await generator.submitTasks<TestContext>(tasks, result => {
                if (result.isSuccess) {
                    successResults.push(result.context.id);
                } else {
                    failResults.push(result.context.id);
                }
            });

            expect(successResults.sort()).toEqual([1, 3]);
            expect(failResults).toEqual([2]);
        });
    });
});
