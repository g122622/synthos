import { HttpConfig, NodeExecutionResult } from "@root/common/contracts/workflow";
import Logger from "@root/common/util/Logger";
import { ExecutionContext } from "@root/common/scheduler/helpers/ExecutionContext";

const LOGGER = Logger.withTag("executeHttpNode");

/**
 * 执行 HTTP 请求节点
 * @param nodeId 节点 ID
 * @param httpConfig HTTP 配置
 * @param context 执行上下文
 * @returns 节点执行结果
 */
export async function executeHttpNode(
    nodeId: string,
    httpConfig: HttpConfig,
    _context: ExecutionContext
): Promise<NodeExecutionResult> {
    const startedAt = Date.now();

    LOGGER.info(`节点 [${nodeId}] 开始执行 HTTP 请求: ${httpConfig.method} ${httpConfig.url}`);

    try {
        const response = await fetch(httpConfig.url, {
            method: httpConfig.method,
            headers: httpConfig.headers || {},
            body: httpConfig.body
        });

        const completedAt = Date.now();

        if (response.ok) {
            const data = await response.text();

            LOGGER.success(`节点 [${nodeId}] HTTP 请求成功，状态码: ${response.status}`);

            return {
                success: true,
                output: {
                    status: response.status,
                    statusText: response.statusText,
                    data
                },
                startedAt,
                completedAt
            };
        } else {
            LOGGER.error(`节点 [${nodeId}] HTTP 请求失败，状态码: ${response.status}`);

            return {
                success: false,
                error: `HTTP 请求失败，状态码: ${response.status}`,
                startedAt,
                completedAt
            };
        }
    } catch (error) {
        const completedAt = Date.now();

        LOGGER.error(`节点 [${nodeId}] HTTP 请求异常: ${(error as Error).message}`);

        return {
            success: false,
            error: (error as Error).message,
            startedAt,
            completedAt
        };
    }
}
