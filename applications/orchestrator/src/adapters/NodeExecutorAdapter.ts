import { NodeExecutionResult, HttpConfig } from "@root/common/contracts/workflow/index";

import { ExecutionContext } from "../core/ExecutionContext";

/**
 * 节点执行器适配器接口
 * 定义了不同类型节点的执行方法
 * 这是工作流引擎与具体业务逻辑解耦的关键接口
 */
export interface NodeExecutorAdapter {
    /**
     * 执行任务节点（调用 Agenda task）
     * @param nodeId 节点 ID
     * @param taskType 任务类型（如 ProvideData、Preprocess 等）
     * @param params 任务参数
     * @param context 执行上下文
     * @returns 节点执行结果
     */
    executeTaskNode(
        nodeId: string,
        taskType: string,
        params: Record<string, any>,
        context: ExecutionContext
    ): Promise<NodeExecutionResult>;

    /**
     * 执行脚本节点（执行自定义 JavaScript 代码）
     * @param nodeId 节点 ID
     * @param scriptCode 脚本代码
     * @param context 执行上下文
     * @returns 节点执行结果
     */
    executeScriptNode(nodeId: string, scriptCode: string, context: ExecutionContext): Promise<NodeExecutionResult>;

    /**
     * 执行 HTTP 请求节点
     * @param nodeId 节点 ID
     * @param httpConfig HTTP 配置
     * @param context 执行上下文
     * @returns 节点执行结果
     */
    executeHttpNode(
        nodeId: string,
        httpConfig: HttpConfig,
        context: ExecutionContext
    ): Promise<NodeExecutionResult>;
}
