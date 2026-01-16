/**
 * Agent 执行器
 * 实现 Function Calling 循环，协调 LLM 和工具调用
 */
import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, ToolMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import Logger from "@root/common/util/Logger";
import { ToolRegistry } from "./ToolRegistry";
import { AI_MODEL_TOKENS } from "../di/tokens";
import {
    AgentConfig,
    AgentResult,
    AgentStreamChunk,
    ChatMessage,
    ToolCall,
    ToolContext,
    TokenUsage
} from "./contracts/index";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import { COMMON_TOKENS } from "@root/common/di/tokens";

@injectable()
export class AgentExecutor {
    private LOGGER = Logger.withTag("AgentExecutor");
    private chatModel: ChatOpenAI | null = null;

    public constructor(
        @inject(AI_MODEL_TOKENS.ToolRegistry) private toolRegistry: ToolRegistry,
        @inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService
    ) {}

    /**
     * 初始化 ChatOpenAI 模型
     */
    private async _initChatModel(config: AgentConfig): Promise<void> {
        const appConfig = await this.configManagerService.getCurrentConfig();
        const defaultModel = appConfig.ai.pinnedModels[0] || "gpt-4";

        this.chatModel = new ChatOpenAI({
            apiKey: appConfig.ai.defaultModelConfig.apiKey,
            configuration: {
                baseURL: appConfig.ai.defaultModelConfig.baseURL
            },
            model: defaultModel,
            temperature: config.temperature ?? 0.7,
            maxTokens: config.maxTokens ?? 2048
        });
    }

    /**
     * 执行 Agent（流式）
     * @param userMessage 用户消息
     * @param context 工具执行上下文
     * @param onChunk 流式 chunk 回调
     * @param config Agent 配置
     * @param historyMessages 历史消息
     * @param systemPrompt 系统提示词
     * @returns Agent 执行结果
     */
    public async executeStream(
        userMessage: string,
        context: ToolContext,
        onChunk: (chunk: AgentStreamChunk) => void,
        config: AgentConfig = {},
        historyMessages: ChatMessage[] = [],
        systemPrompt?: string
    ): Promise<AgentResult> {
        await this._initChatModel(config);

        const maxToolRounds = config.maxToolRounds ?? 5;
        const toolsUsed: Set<string> = new Set();
        let toolRounds = 0;
        let totalUsage: TokenUsage = {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0
        };

        // 构建初始消息列表
        const messages: BaseMessage[] = [];

        // 添加系统提示词
        if (systemPrompt) {
            messages.push(new SystemMessage(systemPrompt));
        }

        // 添加历史消息
        for (const msg of historyMessages) {
            if (msg.role === "user") {
                messages.push(new HumanMessage(msg.content));
            } else if (msg.role === "assistant") {
                messages.push(new AIMessage(msg.content));
            }
        }

        // 添加当前用户消息
        messages.push(new HumanMessage(userMessage));

        // Function Calling 循环
        while (toolRounds < maxToolRounds) {
            // 检查中止信号
            if (config.abortSignal?.aborted) {
                this.LOGGER.info("Agent 执行被中止");
                onChunk({
                    type: "error",
                    error: "执行被用户中止"
                });
                break;
            }

            toolRounds++;
            this.LOGGER.info(`开始第 ${toolRounds} 轮 LLM 调用`);

            try {
                // 获取工具定义（仅第一轮传递）
                const tools = toolRounds === 1 ? this.toolRegistry.getAllToolDefinitions() : undefined;

                // 调用 LLM（流式）
                const { content, toolCalls, usage } = await this._callLLMStream(
                    messages,
                    tools,
                    onChunk,
                    config.abortSignal
                );

                // 累加 Token 使用量
                if (usage) {
                    totalUsage.promptTokens += usage.promptTokens;
                    totalUsage.completionTokens += usage.completionTokens;
                    totalUsage.totalTokens += usage.totalTokens;
                }

                // 如果没有工具调用，返回最终结果
                if (!toolCalls || toolCalls.length === 0) {
                    this.LOGGER.info("LLM 未请求工具调用，返回最终结果");
                    onChunk({
                        type: "done",
                        isFinished: true,
                        usage: totalUsage
                    });

                    return {
                        content,
                        toolsUsed: Array.from(toolsUsed),
                        toolRounds,
                        totalUsage
                    };
                }

                // 执行工具调用
                this.LOGGER.info(`LLM 请求调用 ${toolCalls.length} 个工具`);
                const toolResults = await this._executeToolCalls(toolCalls, context, onChunk, config.abortSignal);

                // 记录使用的工具
                toolCalls.forEach(tc => toolsUsed.add(tc.name));

                // 将工具调用和结果加入消息历史
                messages.push(
                    new AIMessage({
                        content: content || "",
                        tool_calls: toolCalls.map(tc => ({
                            id: tc.id,
                            name: tc.name,
                            args: tc.arguments
                        }))
                    })
                );

                for (const result of toolResults) {
                    messages.push(
                        new ToolMessage({
                            content: JSON.stringify(result.success ? result.result : { error: result.error }),
                            tool_call_id: result.toolCallId
                        })
                    );
                }
            } catch (error) {
                this.LOGGER.error(`Agent 执行出错: ${error}`);
                onChunk({
                    type: "error",
                    error: error instanceof Error ? error.message : String(error)
                });
                throw error;
            }
        }

        // 达到最大轮数限制
        this.LOGGER.warning(`达到最大工具调用轮数 ${maxToolRounds}`);
        onChunk({
            type: "done",
            isFinished: true,
            usage: totalUsage
        });

        return {
            content: "已达到最大工具调用轮数限制，请简化问题或重新提问。",
            toolsUsed: Array.from(toolsUsed),
            toolRounds,
            totalUsage
        };
    }

    /**
     * 调用 LLM（流式）
     */
    private async _callLLMStream(
        messages: BaseMessage[],
        tools: any[] | undefined,
        onChunk: (chunk: AgentStreamChunk) => void,
        abortSignal?: AbortSignal
    ): Promise<{ content: string; toolCalls?: ToolCall[]; usage?: TokenUsage }> {
        let fullContent = "";
        const toolCalls: ToolCall[] = [];
        let lastChunk: any = null;

        // 绑定工具（如果提供）
        const modelWithTools = tools && tools.length > 0 ? this.chatModel!.bind({ tools }) : this.chatModel!;

        const stream = await modelWithTools.stream(messages, {
            signal: abortSignal
        });

        for await (const chunk of stream) {
            lastChunk = chunk;
            // 检查中止信号
            if (abortSignal?.aborted) {
                break;
            }

            // 处理文本内容
            if (typeof chunk.content === "string" && chunk.content) {
                fullContent += chunk.content;
                onChunk({
                    type: "content",
                    content: chunk.content
                });
            }

            // 处理工具调用
            if (chunk.tool_calls && chunk.tool_calls.length > 0) {
                for (const tc of chunk.tool_calls) {
                    toolCalls.push({
                        id: tc.id || crypto.randomUUID(),
                        name: tc.name,
                        arguments: tc.args as Record<string, unknown>
                    });
                }
            }
        }

        // 提取 Token 使用量（如果可用）
        const usage = lastChunk?.usage_metadata
            ? {
                  promptTokens: lastChunk.usage_metadata.input_tokens || 0,
                  completionTokens: lastChunk.usage_metadata.output_tokens || 0,
                  totalTokens: lastChunk.usage_metadata.total_tokens || 0
              }
            : undefined;

        return { content: fullContent, toolCalls: toolCalls.length > 0 ? toolCalls : undefined, usage };
    }

    /**
     * 执行工具调用
     */
    private async _executeToolCalls(
        toolCalls: ToolCall[],
        context: ToolContext,
        onChunk: (chunk: AgentStreamChunk) => void,
        abortSignal?: AbortSignal
    ) {
        const results = [];

        for (const toolCall of toolCalls) {
            // 检查中止信号
            if (abortSignal?.aborted) {
                break;
            }

            // 发送工具开始事件
            onChunk({
                type: "tool_start",
                toolName: toolCall.name,
                toolParams: toolCall.arguments
            });

            // 执行工具
            const result = await this.toolRegistry.executeToolCall(toolCall, context);
            results.push(result);

            // 发送工具结果事件
            onChunk({
                type: "tool_result",
                toolName: toolCall.name,
                toolResult: result.success ? result.result : { error: result.error }
            });
        }

        return results;
    }
}
