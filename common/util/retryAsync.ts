import Logger from "./Logger";
import { sleep } from "./promisify/sleep";

const LOGGER = Logger.withTag("🔄 common/util/retryAsync");

/**
 * 执行带重试机制的异步函数
 *
 * @param fn - 要执行的异步函数
 * @param options - 重试选项
 * @param options.maxRetries - 最大重试次数（不包括首次执行）
 * @param options.retryDelayMs - 重试间隔时间（毫秒）
 * @param options.taskName - 任务名称，用于日志输出
 * @returns Promise<T> - 返回函数执行结果
 * @throws 如果所有重试都失败，则抛出最后一次的错误
 */
export async function retryAsync<T>(
    fn: () => Promise<T>,
    options: {
        maxRetries: number;
        retryDelayMs: number;
        taskName?: string;
    }
): Promise<T> {
    const { maxRetries, retryDelayMs, taskName = "未命名任务" } = options;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                LOGGER.info(`[${taskName}] 第 ${attempt} 次重试...`);
            }

            const result = await fn();

            if (attempt > 0) {
                LOGGER.success(`[${taskName}] 重试成功（第 ${attempt} 次重试）`);
            }

            return result;
        } catch (error) {
            lastError = error as Error;

            LOGGER.error(
                `[${taskName}] 执行失败${attempt < maxRetries ? `（第 ${attempt + 1}/${maxRetries + 1} 次尝试）` : "（已达最大重试次数）"}: ${lastError.message}`
            );

            // 如果还有重试机会，等待后继续
            if (attempt < maxRetries) {
                await sleep(retryDelayMs);
            }
        }
    }

    // 所有重试都失败，抛出最后一次的错误
    throw lastError;
}
