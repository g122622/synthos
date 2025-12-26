import { Disposable } from "@root/common/util/lifecycle/Disposable";
import { TextGenerator } from "./TextGenerator";
import Logger from "@root/common/util/Logger";
import { mustInitBeforeUse } from "@root/common/util/lifecycle/mustInitBeforeUse";

/**
 * 池化任务定义
 */
export interface PooledTask<TContext> {
    /** 输入文本 */
    input: string;
    /** 候选模型列表（每个任务可以不同） */
    modelNames: string[];
    /** 调用方自定义的上下文（用于回调时识别任务） */
    context: TContext;
}

/**
 * 池化任务结果
 */
export interface PooledTaskResult<TContext> {
    isSuccess: boolean;
    selectedModelName?: string;
    content?: string;
    error?: unknown;
    /** 原样返回调用方提供的上下文 */
    context: TContext;
}

/**
 * 支持控制并发数的文本生成器池
 */
@mustInitBeforeUse
export class PooledTextGenerator extends Disposable {
    private readonly maxConcurrency: number;
    private readonly taskQueue: Array<{
        task: () => Promise<void>;
        resolve: () => void;
    }> = [];

    private runningTasks = 0;
    private textGenerator: TextGenerator | null = null;

    private readonly semaphoreQueue: Array<() => void> = [];
    private readonly LOGGER = Logger.withTag("PooledTextGenerator");

    constructor(maxConcurrency: number) {
        super();
        if (maxConcurrency <= 0) {
            throw new Error("maxConcurrency must be greater than 0");
        }
        this.maxConcurrency = maxConcurrency;
    }

    public async init(): Promise<void> {
        this.textGenerator = this._registerDisposable(new TextGenerator());
        await this.textGenerator.init();
        this._registerDisposableFunction(() => {
            // 清空等待中的任务：立即 resolve 但标记为失败
            for (const { resolve } of this.taskQueue) {
                // 注意：results 已由 task closure 捕获，我们只需让 Promise 完成
                resolve();
            }
            this.taskQueue.length = 0;
            this.semaphoreQueue.length = 0;
        });
    }

    /**
     * 信号量：尝试获取一个执行槽位
     */
    private async acquireSlot(): Promise<void> {
        if (this.runningTasks < this.maxConcurrency) {
            this.runningTasks++;
            return;
        }
        // 等待槽位释放
        return new Promise<void>(resolve => {
            this.semaphoreQueue.push(resolve);
        });
    }

    /**
     * 释放一个执行槽位，并唤醒等待者（如有）
     */
    private releaseSlot(): void {
        this.runningTasks--;
        const next = this.semaphoreQueue.shift();
        if (next) {
            this.runningTasks++; // 立即分配槽位
            next();
        }
    }

    /**
     * 执行单个任务（含错误处理和调度）
     */
    private async executeTask(task: () => Promise<void>): Promise<void> {
        try {
            await task();
        } catch (error) {
            this.LOGGER.error("Task failed unexpectedly: " + error);
        } finally {
            this.releaseSlot();
            // 尝试调度下一个任务
            this.processQueue();
        }
    }

    /**
     * 调度队列中的下一个任务（如果还有槽位）
     */
    private processQueue(): void {
        if (this.runningTasks >= this.maxConcurrency) {
            return; // 没有空闲槽位
        }

        const queued = this.taskQueue.shift();
        if (!queued) {
            return; // 队列为空
        }

        this.acquireSlot().then(() => {
            // 注意：acquireSlot 已分配槽位，executeTask 会负责 release
            this.executeTask(queued.task).then(queued.resolve);
        });
    }

    /**
     * 提交任务并在每个任务完成时回调
     * @param tasks 任务列表，每个任务可以携带自定义上下文和独立的模型候选列表
     * @param onTaskComplete 每个任务完成时的回调函数
     */
    public async submitTasks<TContext>(
        tasks: PooledTask<TContext>[],
        onTaskComplete: (result: PooledTaskResult<TContext>) => void | Promise<void>
    ): Promise<void> {
        const taskPromises: Promise<void>[] = [];

        for (const taskDef of tasks) {
            taskPromises.push(
                new Promise<void>(resolve => {
                    const task = async () => {
                        let result: PooledTaskResult<TContext>;
                        try {
                            const generatedResult =
                                await this.textGenerator!.generateTextWithModelCandidates(
                                    taskDef.modelNames,
                                    taskDef.input
                                );

                            result = {
                                isSuccess: true,
                                selectedModelName: generatedResult.selectedModelName,
                                content: generatedResult.content,
                                context: taskDef.context
                            };
                        } catch (error) {
                            this.LOGGER.warning(
                                `任务失败: ${error instanceof Error ? error.message : String(error)}`
                            );
                            result = {
                                isSuccess: false,
                                error,
                                context: taskDef.context
                            };
                        }

                        // 立即回调
                        try {
                            await onTaskComplete(result);
                        } catch (callbackError) {
                            this.LOGGER.error(
                                `回调函数执行失败: ${callbackError instanceof Error ? callbackError.message : String(callbackError)}`
                            );
                        }
                    };

                    this.taskQueue.push({ task, resolve });
                    // 仅在加入任务后尝试调度一次（安全且必要）
                    this.processQueue();
                })
            );
        }

        await Promise.all(taskPromises);
    }

    /**
     * 生成文本（带并发控制）
     * @param modelNames 候选模型列表（每个 input 都使用相同的候选列表）
     * @param inputs 输入文本列表
     * @returns 按输入顺序对应的结果数组
     */
    public async generateTextWithModelCandidates(
        modelNames: string[],
        inputs: string[]
    ): Promise<
        Array<{
            isSuccess: boolean;
            selectedModelName?: string;
            content?: string;
            error?: unknown;
            inputIndex: number;
        }>
    > {
        const results = new Array(inputs.length).fill(null); // 避免稀疏数组
        const taskPromises: Promise<void>[] = [];

        for (let i = 0; i < inputs.length; i++) {
            const input = inputs[i];
            const inputIndex = i;

            taskPromises.push(
                new Promise<void>(resolve => {
                    const task = async () => {
                        try {
                            const result =
                                await this.textGenerator!.generateTextWithModelCandidates(
                                    modelNames,
                                    input
                                );

                            results[inputIndex] = {
                                isSuccess: true,
                                selectedModelName: result.selectedModelName,
                                content: result.content,
                                inputIndex
                            };
                        } catch (error) {
                            this.LOGGER.warning(
                                `Input[${inputIndex}] failed: ${error instanceof Error ? error.message : String(error)}`
                            );
                            results[inputIndex] = {
                                isSuccess: false,
                                error,
                                inputIndex
                            };
                        }
                    };

                    this.taskQueue.push({ task, resolve });
                    // 仅在加入任务后尝试调度一次（安全且必要）
                    this.processQueue();
                })
            );
        }

        await Promise.all(taskPromises);
        return results;
    }
}
