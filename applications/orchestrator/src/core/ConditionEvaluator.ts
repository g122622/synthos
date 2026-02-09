import { ConditionExpression, ConditionExpressionType } from "@root/common/contracts/workflow/index";
import Logger from "@root/common/util/Logger";
import { ExecutionContext } from "@root/common/scheduler/helpers/ExecutionContext";

const LOGGER = Logger.withTag("🔍 ConditionEvaluator");

/**
 * 条件求值器
 * 负责对条件节点的条件表达式进行求值
 */
export class ConditionEvaluator {
    /**
     * 求值条件表达式
     * @param condition 条件表达式
     * @param sourceNodeId 条件节点的源节点 ID（用于获取上游节点状态）
     * @param context 执行上下文
     * @returns 条件求值结果（true/false）
     */
    public evaluate(condition: ConditionExpression, sourceNodeId: string, context: ExecutionContext): boolean {
        switch (condition.type) {
            case ConditionExpressionType.PreviousNodeSuccess:
                return this._evaluatePreviousNodeSuccess(sourceNodeId, context);

            case ConditionExpressionType.PreviousNodeFailed:
                return this._evaluatePreviousNodeFailed(sourceNodeId, context);

            case ConditionExpressionType.KeyValueMatch:
                return this._evaluateKeyValueMatch(condition, context);

            case ConditionExpressionType.CustomExpression:
                LOGGER.warning("CustomExpression 暂未实现，默认返回 false");

                return false;

            default:
                LOGGER.error(`未知的条件类型: ${condition.type}`);

                return false;
        }
    }

    /**
     * 求值 PreviousNodeSuccess 条件
     * @param sourceNodeId 源节点 ID
     * @param context 执行上下文
     * @returns 如果源节点执行成功则返回 true
     */
    private _evaluatePreviousNodeSuccess(sourceNodeId: string, context: ExecutionContext): boolean {
        const result = context.isNodeSuccess(sourceNodeId);

        LOGGER.debug(`条件求值 [PreviousNodeSuccess]: 节点 ${sourceNodeId} 成功 = ${result}`);

        return result;
    }

    /**
     * 求值 PreviousNodeFailed 条件
     * @param sourceNodeId 源节点 ID
     * @param context 执行上下文
     * @returns 如果源节点执行失败则返回 true
     */
    private _evaluatePreviousNodeFailed(sourceNodeId: string, context: ExecutionContext): boolean {
        const result = context.isNodeFailed(sourceNodeId);

        LOGGER.debug(`条件求值 [PreviousNodeFailed]: 节点 ${sourceNodeId} 失败 = ${result}`);

        return result;
    }

    /**
     * 求值 KeyValueMatch 条件
     * @param condition 条件表达式
     * @param context 执行上下文
     * @returns 如果键值匹配则返回 true
     */
    private _evaluateKeyValueMatch(condition: ConditionExpression, context: ExecutionContext): boolean {
        if (!condition.keyPath || condition.expectedValue === undefined) {
            LOGGER.error("KeyValueMatch 条件缺少 keyPath 或 expectedValue");

            return false;
        }

        // 解析 keyPath（如 "nodeA.output.status"）
        const parts = condition.keyPath.split(".");
        let value: any = undefined;

        // 第一部分是节点 ID
        if (parts.length < 2) {
            LOGGER.error(`KeyValueMatch keyPath 格式错误: ${condition.keyPath}`);

            return false;
        }

        const nodeId = parts[0];
        const propertyPath = parts.slice(1);

        // 获取节点结果
        const nodeResult = context.getNodeResult(nodeId);

        if (!nodeResult) {
            LOGGER.debug(`条件求值 [KeyValueMatch]: 节点 ${nodeId} 尚未执行，返回 false`);

            return false;
        }

        // 遍历属性路径
        value = nodeResult as any;
        for (const part of propertyPath) {
            if (value && typeof value === "object" && part in value) {
                value = value[part];
            } else {
                LOGGER.debug(`条件求值 [KeyValueMatch]: 路径 ${condition.keyPath} 不存在，返回 false`);

                return false;
            }
        }

        // 比较值
        const result = value === condition.expectedValue;

        LOGGER.debug(
            `条件求值 [KeyValueMatch]: ${condition.keyPath} = ${JSON.stringify(value)}, 期望 ${JSON.stringify(condition.expectedValue)}, 结果 = ${result}`
        );

        return result;
    }
}
