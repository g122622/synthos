/**
 * 工具调用解析器
 * 用于解析 LLM 文本输出中的工具调用（当模型不支持原生 Function Calling 时）
 */
import Logger from "@root/common/util/Logger";

import { ToolCall } from "../contracts/tools";

export class ToolCallParser {
    private static LOGGER = Logger.withTag("ToolCallParser");

    /**
     * 解析文本中的工具调用
     * 支持格式：
     * ```tool_code
     * tool_name(param1="value1", param2="value2")
     * ```
     * 或：
     * tool_name(param1="value1", param2="value2")
     *
     * @param text LLM 输出的文本
     * @returns 解析出的工具调用数组
     */
    public static parseToolCalls(text: string): ToolCall[] {
        const toolCalls: ToolCall[] = [];

        // 匹配 markdown 代码块中的工具调用
        const codeBlockRegex = /```(?:tool_code|json)?\s*([\s\S]*?)```/g;
        let match;

        while ((match = codeBlockRegex.exec(text)) !== null) {
            const codeContent = match[1].trim();
            const parsed = this.parseToolCallString(codeContent);

            if (parsed) {
                toolCalls.push(parsed);
            }
        }

        // 如果代码块中没找到，尝试直接匹配工具调用格式
        if (toolCalls.length === 0) {
            const directMatch = this.parseToolCallString(text);

            if (directMatch) {
                toolCalls.push(directMatch);
            }
        }

        return toolCalls;
    }

    /**
     * 解析单个工具调用字符串
     * 格式：tool_name(param1="value1", param2=123, param3=true)
     */
    private static parseToolCallString(str: string): ToolCall | null {
        try {
            // 匹配工具名和参数部分
            const toolCallRegex = /^(\w+)\s*\((.*)\)\s*$/;
            const match = str.match(toolCallRegex);

            if (!match) {
                return null;
            }

            const toolName = match[1];
            const paramsStr = match[2];

            // 解析参数
            const args = this.parseArguments(paramsStr);

            this.LOGGER.info(`解析到文本工具调用: ${toolName}, 参数: ${JSON.stringify(args)}`);

            return {
                id: crypto.randomUUID(),
                name: toolName,
                arguments: args
            };
        } catch (error) {
            this.LOGGER.warning(`解析工具调用失败: ${error}`);

            return null;
        }
    }

    /**
     * 解析参数字符串
     * 格式：param1="value1", param2=123, param3=true
     */
    private static parseArguments(paramsStr: string): Record<string, unknown> {
        const args: Record<string, unknown> = {};

        if (!paramsStr.trim()) {
            return args;
        }

        // 匹配参数对：key="value" 或 key=value
        const paramRegex = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\d+\.?\d*)|(\w+))/g;
        let match;

        while ((match = paramRegex.exec(paramsStr)) !== null) {
            const key = match[1];
            const stringValue1 = match[2]; // 双引号字符串
            const stringValue2 = match[3]; // 单引号字符串
            const numberValue = match[4]; // 数字
            const boolOrNull = match[5]; // true/false/null

            let value: unknown;

            if (stringValue1 !== undefined) {
                value = stringValue1;
            } else if (stringValue2 !== undefined) {
                value = stringValue2;
            } else if (numberValue !== undefined) {
                value = parseFloat(numberValue);
            } else if (boolOrNull !== undefined) {
                if (boolOrNull === "true") value = true;
                else if (boolOrNull === "false") value = false;
                else if (boolOrNull === "null") value = null;
                else value = boolOrNull; // 其他标识符当作字符串
            }

            args[key] = value;
        }

        return args;
    }
}
