import { NodeExecutionResult } from "@root/common/contracts/workflow/index";
import { retryAsync } from "@root/common/util/retryAsync";
import { sleep } from "@root/common/util/promisify/sleep";
import Logger from "@root/common/util/Logger";

const LOGGER = Logger.withTag("⚙️ NodeExecutionStrategy");

/**
 * 节点执行策略配置
 */
export interface NodeExecutionStrategyConfig {
    /** 节点 ID */
    nodeId: string;
    /** 重试次数 */
    retryCount: number;
    /** 超时时间（毫秒） */
    timeoutMs: number;
    /** 失败时是否跳过 */
    skipOnFailure: boolean;
}

/**
 * 节点执行策略
 * 负责处理节点执行的重试、超时、跳过等策略
 */
export class NodeExecutionStrategy {
    /**
     * 使用策略执行节点
     * @param config 策略配置
     * @param executor 实际执行函数
     * @returns 节点执行结果
     */
    public async executeWithStrategy(
        config: NodeExecutionStrategyConfig,
        executor: () => Promise<NodeExecutionResult>
    ): Promise<NodeExecutionResult> {
        const { nodeId, retryCount, timeoutMs, skipOnFailure } = config;

        LOGGER.info(
            `节点 [${nodeId}] 执行策略: 重试${retryCount}次, 超时${timeoutMs}ms, 失败跳过=${skipOnFailure}`
        );

        try {
            // 使用 retryAsync 实现重试机制
            const result = await retryAsync(
                async () => {
                    // 如果设置了超时，使用 Promise.race 实现超时控制
                    if (timeoutMs > 0) {
                        return await this._executeWithTimeout(nodeId, executor, timeoutMs);
                    } else {
                        return await executor();
                    }
                },
                {
                    maxRetries: retryCount,
                    retryDelayMs: 3000, // 重试间隔 3 秒
                    taskName: `节点 ${nodeId}`
                }
            );

            return result;
        } catch (error) {
            // 如果设置了 skipOnFailure，返回失败结果但不抛出异常
            if (skipOnFailure) {
                LOGGER.warning(`节点 [${nodeId}] 执行失败，但设置了 skipOnFailure，将继续执行`);

                return {
                    success: false,
                    error: (error as Error).message,
                    startedAt: Date.now(),
                    completedAt: Date.now()
                };
            } else {
                // 否则重新抛出异常，终止流程
                throw error;
            }
        }
    }

    /**
     * 使用超时控制执行节点
     * @param nodeId 节点 ID
     * @param executor 实际执行函数
     * @param timeoutMs 超时时间（毫秒）
     * @returns 节点执行结果
     */
    private async _executeWithTimeout(
        nodeId: string,
        executor: () => Promise<NodeExecutionResult>,
        timeoutMs: number
    ): Promise<NodeExecutionResult> {
        const timeoutPromise = sleep(timeoutMs).then(() => {
            throw new Error(`节点 [${nodeId}] 执行超时（${timeoutMs}ms）`);
        });

        return await Promise.race([executor(), timeoutPromise]);
    }
}
