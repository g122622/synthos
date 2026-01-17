/**
 * 工具注册表
 * 管理所有可用工具的注册、查询和执行
 */
import "reflect-metadata";
import { injectable } from "tsyringe";
import Logger from "@root/common/util/Logger";
import {
    ToolDefinition,
    RegisteredTool,
    ToolExecutor,
    ToolCall,
    ToolExecutionResult,
    ToolContext
} from "./contracts/index";

@injectable()
export class ToolRegistry {
    private LOGGER = Logger.withTag("ToolRegistry");
    private tools: Map<string, RegisteredTool> = new Map();

    /**
     * 注册一个工具
     * @param definition 工具定义
     * @param executor 工具执行器
     */
    public registerTool(definition: ToolDefinition, executor: ToolExecutor): void {
        const toolName = definition.function.name;
        if (this.tools.has(toolName)) {
            this.LOGGER.warning(`工具 ${toolName} 已存在，将被覆盖`);
        }
        this.tools.set(toolName, { definition, executor });
        this.LOGGER.debug(`工具 ${toolName} 注册成功`);
    }

    /**
     * 获取所有工具定义（用于传递给 LLM）
     * @returns 工具定义数组
     */
    public getAllToolDefinitions(): ToolDefinition[] {
        const definitions = Array.from(this.tools.values()).map(tool => tool.definition);
        this.LOGGER.debug(`获取工具定义，当前注册工具数: ${this.tools.size}`);
        return definitions;
    }

    /**
     * 执行单个工具调用
     * @param toolCall 工具调用信息
     * @param context 工具执行上下文
     * @returns 工具执行结果
     */
    public async executeToolCall(toolCall: ToolCall, context: ToolContext): Promise<ToolExecutionResult> {
        const toolName = toolCall.name;
        const tool = this.tools.get(toolName);

        if (!tool) {
            this.LOGGER.error(`未找到工具: ${toolName}`);
            return {
                toolName,
                toolCallId: toolCall.id,
                success: false,
                error: `未找到工具: ${toolName}`
            };
        }

        // 自动补全/归一化参数（用于模型输出不完整时的兜底）
        const normalizedArgs = this.normalizeToolArguments(toolName, toolCall.arguments, context);
        toolCall.arguments = normalizedArgs;

        const validationError = this.validateToolArguments(tool.definition, toolCall.arguments);
        if (validationError) {
            this.LOGGER.warning(`工具 ${toolName} 参数校验失败: ${validationError}`);
            return {
                toolName,
                toolCallId: toolCall.id,
                success: false,
                error: validationError
            };
        }

        try {
            this.LOGGER.debug(`执行工具: ${toolName}，参数: ${JSON.stringify(toolCall.arguments)}`);
            const result = await tool.executor(toolCall.arguments, context);

            const resultHasErrorField =
                typeof result === "object" &&
                result !== null &&
                "error" in (result as Record<string, unknown>) &&
                typeof (result as Record<string, unknown>).error === "string" &&
                ((result as Record<string, unknown>).error as string).trim().length > 0;

            if (resultHasErrorField) {
                this.LOGGER.warning(
                    `工具 ${toolName} 执行完成（返回 error 字段）: ${(result as Record<string, unknown>).error}`
                );
            } else {
                this.LOGGER.debug(`工具 ${toolName} 执行完成`);
            }

            return {
                toolName,
                toolCallId: toolCall.id,
                success: true,
                result
            };
        } catch (error) {
            this.LOGGER.error(`工具 ${toolName} 执行失败: ${error}`);
            return {
                toolName,
                toolCallId: toolCall.id,
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    private normalizeToolArguments(
        toolName: string,
        args: Record<string, unknown>,
        context: ToolContext
    ): Record<string, unknown> {
        if (toolName !== "web_search") {
            return args;
        }

        const rawQuery = args.query;
        const queryIsValid = typeof rawQuery === "string" && rawQuery.trim().length > 0;
        if (queryIsValid) {
            return args;
        }

        const fallback =
            (typeof context.userQuestion === "string" && context.userQuestion.trim().length > 0
                ? context.userQuestion
                : undefined) ||
            (typeof (context as any).question === "string" &&
            ((context as any).question as string).trim().length > 0
                ? ((context as any).question as string)
                : undefined);

        if (!fallback) {
            return args;
        }

        this.LOGGER.info(`工具 web_search 缺少 query，已自动使用用户问题补全`);
        return {
            ...args,
            query: fallback
        };
    }

    private validateToolArguments(definition: ToolDefinition, args: Record<string, unknown>): string | null {
        const required = definition.function.parameters.required || [];
        for (const key of required) {
            const value = args[key];
            if (value === undefined || value === null) {
                return `缺少必填参数: ${key}`;
            }
            if (typeof value === "string" && value.trim().length === 0) {
                return `必填参数为空: ${key}`;
            }
        }
        return null;
    }

    /**
     * 批量执行多个工具调用
     * @param toolCalls 工具调用数组
     * @param context 工具执行上下文
     * @returns 工具执行结果数组
     */
    public async executeToolCalls(toolCalls: ToolCall[], context: ToolContext): Promise<ToolExecutionResult[]> {
        const results: ToolExecutionResult[] = [];
        for (const toolCall of toolCalls) {
            const result = await this.executeToolCall(toolCall, context);
            results.push(result);
        }
        return results;
    }

    /**
     * 检查工具是否已注册
     * @param toolName 工具名称
     * @returns 是否已注册
     */
    public hasTool(toolName: string): boolean {
        return this.tools.has(toolName);
    }

    /**
     * 获取已注册工具数量
     * @returns 工具数量
     */
    public getToolCount(): number {
        return this.tools.size;
    }
}
