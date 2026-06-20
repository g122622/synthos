/**
 * Worker 线程池管理器
 *
 * 管理一组常驻 Worker 线程，每个 Worker 持有独立的数据库连接。
 * 任务以群组为最小单位提交，空闲 Worker 自动接收任务。
 */

import type {
    MainToWorkerMessage,
    WorkerToMainMessage,
    WorkerConfig,
    WorkerQueryMessage,
    WorkerInitMessage
} from "./types";

import { Worker } from "node:worker_threads";
import { randomUUID } from "node:crypto";

import Logger from "@root/common/util/Logger";
import { Disposable } from "@root/common/util/lifecycle/Disposable";
import { RawChatMessage } from "@root/common/contracts/data-provider/index";

/** 待处理的查询任务 */
interface PendingTask {
    resolve: (data: RawChatMessage[]) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
}

/** Worker 线程句柄 */
interface WorkerHandle {
    worker: Worker;
    pendingTasks: Map<string, PendingTask>;
    initialized: boolean;
}

/** WorkerPool 配置选项 */
export interface WorkerPoolOptions {
    /** 线程池大小 */
    poolSize: number;
    /** Worker 初始化配置 */
    config: WorkerConfig;
    /** Worker 脚本的绝对路径 */
    workerScriptPath: string;
    /** 单个任务超时时间（毫秒），默认 120000（2分钟） */
    taskTimeoutMs?: number;
    /** Worker 初始化超时时间（毫秒），默认 30000 */
    initTimeoutMs?: number;
}

export class WorkerPool extends Disposable {
    private workers: WorkerHandle[] = [];
    private taskQueue: Array<{
        taskId: string;
        msg: WorkerQueryMessage;
        resolve: (data: RawChatMessage[]) => void;
        reject: (error: Error) => void;
    }> = [];
    private LOGGER = Logger.withTag("WorkerPool");
    private options: Required<WorkerPoolOptions>;
    private initialized = false;
    private initPromise: Promise<void> | null = null;

    constructor(options: WorkerPoolOptions) {
        super();
        this.options = {
            taskTimeoutMs: 120000,
            initTimeoutMs: 30000,
            ...options
        };
        this._registerDisposableFunction(() => this.disposeAll());
    }

    /**
     * 初始化线程池：创建所有 Worker，发送初始化配置，等待所有 Worker 就绪
     */
    public async init(): Promise<void> {
        if (this.initPromise) return this.initPromise;

        this.initPromise = this._doInit();

        return this.initPromise;
    }

    private async _doInit(): Promise<void> {
        const { poolSize, config, workerScriptPath } = this.options;

        this.LOGGER.info(`正在初始化 Worker 线程池，大小: ${poolSize}...`);

        const initPromises: Promise<void>[] = [];

        for (let i = 0; i < poolSize; i++) {
            const worker = new Worker(workerScriptPath);

            const handle: WorkerHandle = {
                worker,
                pendingTasks: new Map(),
                initialized: false
            };

            // 设置消息处理器
            worker.on("message", (msg: WorkerToMainMessage) => {
                this._handleWorkerMessage(handle, msg);
            });

            worker.on("error", (err: Error) => {
                this._handleWorkerError(handle, err);
            });

            worker.on("exit", (code: number) => {
                this._handleWorkerExit(handle, code);
            });

            this.workers.push(handle);

            // 发送 init 配置并等待 ready
            const initP = new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error(`Worker #${i} 初始化超时 (${this.options.initTimeoutMs}ms)`));
                }, this.options.initTimeoutMs);

                const handler = (msg: WorkerToMainMessage) => {
                    if (msg.type === "ready") {
                        clearTimeout(timeout);
                        handle.initialized = true;
                        worker.off("message", handler);
                        resolve();
                    } else if (msg.type === "fatal_error") {
                        clearTimeout(timeout);
                        worker.off("message", handler);
                        reject(new Error(`Worker #${i} 初始化失败: ${msg.error}`));
                    }
                };

                worker.on("message", handler);
            });

            worker.postMessage({ type: "init", config } satisfies WorkerInitMessage);
            initPromises.push(initP);
        }

        await Promise.all(initPromises);
        this.initialized = true;
        this.LOGGER.success(`Worker 线程池初始化完成，${poolSize} 个 Worker 已就绪`);
    }

    /**
     * 提交查询任务。返回 Promise，在 Worker 返回结果时 resolve。
     * 如果所有 Worker 都忙，任务进入队列等待。
     */
    public submit(timeStart: number, timeEnd: number, groupId: string): Promise<RawChatMessage[]> {
        if (!this.initialized) {
            throw new Error("WorkerPool 尚未初始化");
        }

        const taskId = randomUUID();
        const msg: WorkerQueryMessage = {
            type: "query",
            taskId,
            timeStart,
            timeEnd,
            groupId
        };

        return new Promise<RawChatMessage[]>((resolve, reject) => {
            // 尝试找到空闲的 Worker
            const idleWorker = this.workers.find(w => w.initialized && w.pendingTasks.size === 0);

            if (idleWorker) {
                this._dispatchToWorker(idleWorker, taskId, msg, resolve, reject);
            } else {
                // 所有 Worker 都忙，入队等待
                this.taskQueue.push({ taskId, msg, resolve, reject });
            }
        });
    }

    /**
     * 将任务派发给指定 Worker
     */
    private _dispatchToWorker(
        handle: WorkerHandle,
        taskId: string,
        msg: WorkerQueryMessage,
        resolve: (data: RawChatMessage[]) => void,
        reject: (error: Error) => void
    ): void {
        const timer = setTimeout(() => {
            handle.pendingTasks.delete(taskId);
            reject(new Error(`任务 ${taskId} 超时 (${this.options.taskTimeoutMs}ms)`));
            this._drainQueue();
        }, this.options.taskTimeoutMs);

        handle.pendingTasks.set(taskId, { resolve, reject, timer });
        handle.worker.postMessage(msg);
    }

    /**
     * 处理 Worker 发来的消息
     */
    private _handleWorkerMessage(handle: WorkerHandle, msg: WorkerToMainMessage): void {
        switch (msg.type) {
            case "query_result": {
                const pending = handle.pendingTasks.get(msg.taskId);

                if (pending) {
                    clearTimeout(pending.timer);
                    handle.pendingTasks.delete(msg.taskId);
                    pending.resolve(msg.data);
                    this._drainQueue();
                }
                break;
            }
            case "query_error": {
                const pending = handle.pendingTasks.get(msg.taskId);

                if (pending) {
                    clearTimeout(pending.timer);
                    handle.pendingTasks.delete(msg.taskId);
                    pending.reject(new Error(msg.error));
                    this._drainQueue();
                }
                break;
            }
            case "fatal_error": {
                this.LOGGER.error(`Worker 遇到致命错误: ${msg.error}`);
                // 拒绝该 Worker 上的所有待处理任务
                for (const [taskId, pending] of handle.pendingTasks) {
                    clearTimeout(pending.timer);
                    pending.reject(new Error(`Worker 崩溃: ${msg.error}`));
                }
                handle.pendingTasks.clear();
                handle.initialized = false;
                break;
            }
            case "shutdown_complete": {
                // 在 dispose 流程中处理
                break;
            }
            case "ready": {
                // init 阶段的临时 handler 已处理，忽略后续的 ready
                break;
            }
        }
    }

    /**
     * 处理 Worker 错误
     */
    private _handleWorkerError(handle: WorkerHandle, err: Error): void {
        this.LOGGER.error(`Worker 线程错误: ${err.message}`);
        // 拒绝该 Worker 上的所有待处理任务
        for (const [taskId, pending] of handle.pendingTasks) {
            clearTimeout(pending.timer);
            pending.reject(new Error(`Worker 线程错误: ${err.message}`));
        }
        handle.pendingTasks.clear();
        handle.initialized = false;
    }

    /**
     * 处理 Worker 退出
     */
    private _handleWorkerExit(handle: WorkerHandle, code: number): void {
        this.LOGGER.warning(`Worker 线程退出，退出码: ${code}`);
        // 拒绝该 Worker 上的所有待处理任务
        for (const [taskId, pending] of handle.pendingTasks) {
            clearTimeout(pending.timer);
            pending.reject(new Error(`Worker 线程意外退出，退出码: ${code}`));
        }
        handle.pendingTasks.clear();
        handle.initialized = false;
    }

    /**
     * 从队列中取出任务派发给空闲 Worker
     */
    private _drainQueue(): void {
        while (this.taskQueue.length > 0) {
            const idleWorker = this.workers.find(w => w.initialized && w.pendingTasks.size === 0);

            if (!idleWorker) break;

            const task = this.taskQueue.shift()!;

            this._dispatchToWorker(idleWorker, task.taskId, task.msg, task.resolve, task.reject);
        }
    }

    /**
     * 关闭所有 Worker 线程
     */
    private async disposeAll(): Promise<void> {
        this.LOGGER.info("正在关闭 Worker 线程池...");

        // 拒绝队列中所有等待的任务
        for (const task of this.taskQueue) {
            task.reject(new Error("Worker 线程池正在关闭"));
        }
        this.taskQueue = [];

        // 拒绝所有 Worker 上待处理的任务
        for (const handle of this.workers) {
            for (const [taskId, pending] of handle.pendingTasks) {
                clearTimeout(pending.timer);
                pending.reject(new Error("Worker 线程池正在关闭"));
            }
            handle.pendingTasks.clear();
        }

        // 向所有 Worker 发送关闭消息
        const shutdownPromises = this.workers.map(handle => {
            return new Promise<void>(resolve => {
                const timeout = setTimeout(() => {
                    this.LOGGER.warning("Worker 关闭超时，强制终止");
                    handle.worker.terminate();
                    resolve();
                }, 5000);

                handle.worker.on("exit", () => {
                    clearTimeout(timeout);
                    resolve();
                });

                try {
                    handle.worker.postMessage({ type: "shutdown" } satisfies MainToWorkerMessage);
                } catch {
                    // Worker 可能已经退出
                    clearTimeout(timeout);
                    resolve();
                }
            });
        });

        await Promise.allSettled(shutdownPromises);

        // 强制终止所有剩余的 Worker
        for (const handle of this.workers) {
            await handle.worker.terminate();
        }

        this.workers = [];
        this.initialized = false;
        this.LOGGER.success("Worker 线程池已关闭");
    }
}
