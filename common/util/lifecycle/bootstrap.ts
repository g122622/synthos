/**
 * File: bootstrap.ts
 * Description: 实现 @bootstrap 装饰器，用于标记需要在 Node 进程启动后自动执行的类
 * Detail: 被 @bootstrap 装饰的类会在调用 bootstrapAll() 时自动实例化并调用其 main() 方法
 */

import Logger from "../Logger";

const LOGGER = Logger.withTag("Bootstrap");

/**
 * 定义 Bootstrap 类的接口：必须包含 main 方法
 */
interface IBootstrappable {
    main(): void | Promise<void>;
}

/**
 * Bootstrap 类的构造函数类型
 */
type BootstrappableConstructor = new (...args: any[]) => IBootstrappable;

/**
 * 存储所有被 @bootstrap 装饰的类
 */
const bootstrappableClasses: BootstrappableConstructor[] = [];

/**
 * @bootstrap 装饰器
 * 被此装饰器标记的类会在调用 bootstrapAll() 时自动实例化并执行其 main() 方法
 *
 * @example
 * ```typescript
 * @bootstrap
 * class MyService {
 *     public main(): void {
 *         console.log("MyService 启动");
 *     }
 * }
 * ```
 */
export function bootstrap<T extends BootstrappableConstructor>(constructor: T): T {
    // 检查类是否实现了 main 方法
    if (typeof constructor.prototype.main !== "function") {
        throw new Error(`类 "${constructor.name}" 使用了 @bootstrap 装饰器，但未实现 main() 方法`);
    }

    // 将类注册到全局列表
    bootstrappableClasses.push(constructor);
    LOGGER.debug(`已注册 Bootstrap 类: ${constructor.name}`);

    return constructor;
}

/**
 * bootstrapAll 的配置选项
 */
interface BootstrapAllOptions {
    /**
     * 是否在遇到第一个错误时立即停止并抛出异常
     * - true: 快速失败，遇到错误立即停止进程启动
     * - false: 继续执行其他 bootstrap 类，最后汇总所有错误
     * @default true
     */
    failFast?: boolean;
}

/**
 * Bootstrap 执行结果
 */
interface BootstrapResult {
    /** 成功执行的类名列表 */
    succeeded: string[];
    /** 失败的类名和对应的错误 */
    failed: Array<{ className: string; error: Error }>;
}

/**
 * 执行所有已注册的 Bootstrap 类的 main() 方法
 *
 * @param options 配置选项
 * @returns 返回执行结果，包含成功和失败的类信息
 * @throws 当 failFast 为 true（默认）且有任何 main() 方法执行失败时，抛出错误
 *
 * @example
 * ```typescript
 * // 默认行为：遇到错误立即停止
 * await bootstrapAll();
 *
 * // 继续执行所有 bootstrap 类，即使某些失败
 * const result = await bootstrapAll({ failFast: false });
 * if (result.failed.length > 0) {
 *     console.error("部分 Bootstrap 类执行失败:", result.failed);
 * }
 * ```
 */
export async function bootstrapAll(options: BootstrapAllOptions = {}): Promise<BootstrapResult> {
    const { failFast = true } = options;

    const result: BootstrapResult = {
        succeeded: [],
        failed: []
    };

    if (bootstrappableClasses.length === 0) {
        LOGGER.warning("没有找到任何被 @bootstrap 装饰的类");
        return result;
    }

    LOGGER.info(`开始执行 ${bootstrappableClasses.length} 个 Bootstrap 类...`);

    for (const BootstrapClass of bootstrappableClasses) {
        const className = BootstrapClass.name;

        try {
            LOGGER.debug(`正在执行 Bootstrap 类: ${className}`);

            // 实例化类并调用 main 方法
            const instance = new BootstrapClass();
            const mainResult = instance.main();

            // 如果 main 返回 Promise，等待其完成
            if (mainResult instanceof Promise) {
                await mainResult;
            }

            result.succeeded.push(className);
            LOGGER.success(`Bootstrap 类 "${className}" 执行成功`);
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            result.failed.push({ className, error: err });
            LOGGER.error(`Bootstrap 类 "${className}" 执行失败: ${err.message}`);

            if (failFast) {
                throw new Error(
                    `Bootstrap 失败: 类 "${className}" 的 main() 方法执行出错。错误信息: ${err.message}`
                );
            }
        }
    }

    if (result.failed.length > 0 && !failFast) {
        LOGGER.warning(
            `Bootstrap 完成，但有 ${result.failed.length} 个类执行失败: ` +
                result.failed.map(f => f.className).join(", ")
        );
    } else if (result.failed.length === 0) {
        LOGGER.success(`所有 ${result.succeeded.length} 个 Bootstrap 类执行成功`);
    }

    return result;
}

/**
 * 获取所有已注册的 Bootstrap 类（主要用于测试和调试）
 */
export function getRegisteredBootstrapClasses(): readonly BootstrappableConstructor[] {
    return [...bootstrappableClasses];
}

/**
 * 清除所有已注册的 Bootstrap 类（主要用于测试）
 */
export function clearRegisteredBootstrapClasses(): void {
    bootstrappableClasses.length = 0;
    LOGGER.debug("已清除所有注册的 Bootstrap 类");
}

export type { IBootstrappable, BootstrapAllOptions, BootstrapResult };

// 使用示例
// import { bootstrap, bootstrapAll } from "@root/common/util/lifecycle/bootstrap";

// @bootstrap
// class MyService {
//     public main(): void {
//         console.log("MyService 启动");
//     }
// }

// @bootstrap
// class AnotherService {
//     public async main(): Promise<void> {
//         await doSomeAsyncWork();
//     }
// }

// // 在应用入口调用
// await bootstrapAll(); // 默认 failFast: true

// // 或者允许继续执行即使某些失败
// const result = await bootstrapAll({ failFast: false });
// if (result.failed.length > 0) {
//     console.error("部分服务启动失败:", result.failed);
// }
