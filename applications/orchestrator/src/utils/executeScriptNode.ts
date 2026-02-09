import { NodeExecutionResult } from "@root/common/contracts/workflow";
import Logger from "@root/common/util/Logger";
import { ExecutionContext } from "@root/common/scheduler/helpers/ExecutionContext";

const LOGGER = Logger.withTag("executeScriptNode");

/**
 * 执行脚本节点
 * @param nodeId 节点 ID
 * @param scriptCode 脚本代码
 * @param context 执行上下文
 * @returns 节点执行结果
 */
export async function executeScriptNode(
    nodeId: string,
    scriptCode: string,
    context: ExecutionContext
): Promise<NodeExecutionResult> {
    const startedAt = Date.now();

    LOGGER.info(`节点 [${nodeId}] 开始执行脚本`);

    try {
        // 创建一个沙箱环境，提供 context 访问
        const sandbox = {
            context,
            console: {
                log: (...args: any[]) => LOGGER.info(`脚本输出: ${args.join(" ")}`),
                error: (...args: any[]) => LOGGER.error(`脚本错误: ${args.join(" ")}`)
            }
        };

        // 使用 Function 构造函数执行脚本（比 eval 更安全）
        const fn = new Function("sandbox", `with(sandbox) { ${scriptCode} }`);
        const output = fn(sandbox);

        const completedAt = Date.now();

        LOGGER.success(`节点 [${nodeId}] 脚本执行成功`);

        return {
            success: true,
            output,
            startedAt,
            completedAt
        };
    } catch (error) {
        const completedAt = Date.now();

        LOGGER.error(`节点 [${nodeId}] 脚本执行失败: ${(error as Error).message}`);

        return {
            success: false,
            error: (error as Error).message,
            startedAt,
            completedAt
        };
    }
}
