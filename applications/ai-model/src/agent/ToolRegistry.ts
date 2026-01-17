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

        try {
            this.LOGGER.debug(`执行工具: ${toolName}，参数: ${JSON.stringify(toolCall.arguments)}`);
            const result = await tool.executor(toolCall.arguments, context);
            this.LOGGER.debug(`工具 ${toolName} 执行成功`);
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
