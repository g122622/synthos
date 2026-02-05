/**
 * File: Disposable.ts
 * Description: 实现 IDisposable 接口的基类
 * Detail: 实现 IDisposable 接口的基类，提供注册和释放资源的方法，并提供是否已释放的状态
 * Note: 该类主要用于管理生命周期相关的资源，如事件监听、定时器、已打开的文件资源等。
 * 支持自动追踪根节点对象，自动维护依赖间的树形结构，并响应系统信号进行优雅退出。
 * （退出时会自动从树根开始后序遍历递归释放所有资源）
 */

import Logger from "../Logger";
import ErrorReasons from "../../contracts/ErrorReasons";

interface IDisposable {
    dispose(): Promise<void> | void;
}

const LOGGER = Logger.withTag("Disposable");

class Disposable implements IDisposable {
    // =========================================================================
    // Static Logic: 全局生命周期管理
    // =========================================================================

    // 存储所有“根”对象。即：未被其他 Disposable 注册为子对象的实例。
    private static _roots = new Set<Disposable>();

    /**
     * 开启全局信号监听 (SIGINT, SIGTERM)
     * 在应用启动时调用一次即可。
     */
    public static enableGlobalSignalHandling() {
        const handleSignal = async (signal: string) => {
            LOGGER.warning(`收到${signal}信号. 全局错误处理器介入. 开始递归释放所有资源...`);

            const promises: Promise<void>[] = [];

            // 复制一份集合进行遍历，防止 dispose 过程中修改集合导致迭代问题
            const currentRoots = Array.from(Disposable._roots);

            for (const root of currentRoots) {
                // 调用 dispose，兼容同步和异步
                const result = root.dispose();

                if (result instanceof Promise) {
                    promises.push(result);
                }
            }

            try {
                await Promise.allSettled(promises);
                LOGGER.success("所有资源已释放. 退出进程.");
                process.exit(0);
            } catch (error) {
                LOGGER.error("全局释放过程中发生错误: " + error);
                process.exit(1);
            }
        };

        // 监听 Ctrl+C 和 终止信号
        process.on("SIGINT", () => handleSignal("SIGINT"));
        process.on("SIGTERM", () => handleSignal("SIGTERM"));

        // 监听未捕获的异常，一旦发生未捕获的异常，会自动释放所有资源并退出进程
        process.on("uncaughtException", error => {
            LOGGER.error("Uncaught exception: " + error);
            handleSignal("uncaughtException");
        });

        // 监听未处理的拒绝的 Promise，一旦发生未处理的拒绝的 Promise，会自动释放所有资源并退出进程
        process.on("unhandledRejection", (reason, promise) => {
            LOGGER.error("Unhandled rejection: " + reason);
            handleSignal("unhandledRejection");
        });
    }

    // =========================================================================
    // Instance Logic
    // =========================================================================

    // 存储需要释放的资源
    private _disposables = new Set<IDisposable>();
    // 标记是否已释放
    private _isDisposed = false;

    constructor() {
        // 🆕 默认认为自己是一个 Root 对象，加入全局集合
        // 如果稍后被 _registerDisposable 注册给别人，会从集合中移除
        Disposable._roots.add(this);
    }

    /**
     * 注册一个可释放对象
     * @param disposable 需要管理生命周期的对象
     * @returns 返回入参以便链式调用
     */
    protected _registerDisposable<T extends IDisposable | null | undefined>(disposable: T): T {
        if (!disposable) {
            LOGGER.warning("Cannot register null or undefined disposable");

            return disposable;
        }
        if (this._isDisposed) {
            LOGGER.warning("Cannot register disposable on a disposed object. Disposing the disposable instead!");
            disposable.dispose();

            return disposable;
        } else {
            if ((disposable as unknown as Disposable) === this) {
                LOGGER.error("Cannot register a disposable on itself!");
                throw ErrorReasons.CYCLIC_REFERENCE_ERROR;
            }

            this._disposables.add(disposable);

            // 🆕 关键逻辑：如果注册的对象也是 Disposable 的实例
            // 说明它有了父级，不再是“根”，从全局 _roots 集合中移除
            if (disposable instanceof Disposable) {
                Disposable._roots.delete(disposable);
            }
        }

        return disposable;
    }

    /**
     * 注册一个异步函数
     * @param func 需要管理生命周期的异步函数
     * @note ⚠️⚠️⚠️必须传入箭头函数避免this指向丢失
     */
    protected _registerDisposableFunction(func: () => Promise<void> | void): void {
        if (!func) {
            LOGGER.error("Cannot register null or undefined disposable");

            return;
        }
        this._registerDisposable({
            dispose: func
        });
    }

    /**
     * 释放所有资源。这个函数不允许被override。
     */
    async dispose() {
        // 🆕 无论自己是不是根，一旦被销毁，就不应该再存在于根集合中
        Disposable._roots.delete(this);

        if (this._isDisposed) return;

        // 遍历释放所有资源
        const promises = [] as Array<Promise<void>>; // 存储所有异步任务的 Promise

        this._disposables.forEach(disposable => {
            try {
                const promise = disposable.dispose();

                if (promise && typeof promise.then === "function") {
                    promises.push(promise);
                }
            } catch (e) {
                console.error("Error disposing object: ", e);
            }
        });

        return Promise.allSettled(promises)
            .then(results => {
                // 检查results数组中的每个promise是否被成功解决
                for (const result of results) {
                    if (result.status === "rejected") {
                        LOGGER.error("Error disposing object: " + result.reason);
                    }
                }

                // 清除disposables集合
                this._disposables.clear();

                // 清除这个对象的所有属性（除了 _isDisposed）
                // ⚠️ 注意：这是一种激进的内存清理策略，确保不会有悬垂引用
                // TODO Fix me:
                // 但可能会导致一些问题，比如：
                // Error disposing objects: TypeError: Cannot read properties of undefined (reading 'clear')
                // at file:///xxx/synthos/common/dist/util/lifecycle/Disposable.js:133:31
                // 原因未知。

                // for (const key in this) {
                //     if (key !== "_isDisposed" && this.hasOwnProperty(key)) {
                //         delete this[key];
                //     }
                // }

                this._isDisposed = true;
            })
            .catch(e => {
                console.error("Error disposing objects:", e);
                this._isDisposed = false;
            });
    }

    /**
     * 检查是否已释放
     */
    get isDisposed(): boolean {
        return this._isDisposed;
    }
}

Disposable.enableGlobalSignalHandling();

export { Disposable };
export type { IDisposable };
