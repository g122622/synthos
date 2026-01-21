/**
 * Agent 执行器
 * 实现 Function Calling 循环，协调 LLM 和工具调用
 */
import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import { HumanMessage, AIMessage, ToolMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import util from "util";
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
import { TextGeneratorService } from "../services/generators/text/TextGeneratorService";
import { ToolCallParser } from "./utils/ToolCallParser";
import { VariableSpaceService } from "./services/VariableSpaceService";

@injectable()
export class AgentExecutor {
    private LOGGER = Logger.withTag("AgentExecutor");

    private _getSessionIdFromContext(context: ToolContext): string | null {
        const sid = context.sessionId;
        if (typeof sid !== "string") return null;
        const trimmed = sid.trim();
        return trimmed.length > 0 ? trimmed : null;
    }

    private _shouldRequireEvidenceRef(context: ToolContext): boolean {
        return (context as any)?.__requireEvidenceRef === true;
    }

    private _decorateToolOutputWithRef(toolOutput: unknown, archivedRef: string | undefined): unknown {
        if (!archivedRef) {
            return toolOutput;
        }

        // 尽量保持原始结构：对象则注入字段；非对象则包装
        if (toolOutput && typeof toolOutput === "object" && !Array.isArray(toolOutput)) {
            const obj = toolOutput as Record<string, unknown>;
            if ("__ref" in obj) {
                // 避免覆盖用户/工具已有字段
                return {
                    ...obj,
                    __archivedRef: archivedRef
                };
            }
            return {
                ...obj,
                __ref: archivedRef
            };
        }

        return {
            result: toolOutput,
            __ref: archivedRef
        };
    }

    private async _archiveToolExecution(
        toolCall: ToolCall,
        context: ToolContext,
        execution: { success: boolean; result?: unknown; error?: string }
    ): Promise<string | undefined> {
        const sessionId = this._getSessionIdFromContext(context);
        if (!sessionId) {
            return undefined;
        }

        const archivedKey = `evidence.tool_call.${toolCall.id}`;
        const now = Date.now();

        const payload = {
            toolName: toolCall.name,
            toolCallId: toolCall.id,
            toolArgs: toolCall.arguments,
            success: execution.success,
            result: execution.success ? execution.result : undefined,
            error: execution.success ? undefined : execution.error,
            archivedAt: now
        };

        const summary = `工具证据归档: ${toolCall.name} (${execution.success ? "success" : "error"})`;
        await this.variableSpaceService.set(sessionId, archivedKey, payload, summary);
        return archivedKey;
    }

    private _formatMessagesForLog(messages: BaseMessage[]) {
        return messages.map(m => {
            const anyMsg = m as any;
            const type = typeof anyMsg?._getType === "function" ? anyMsg._getType() : anyMsg?.type;

            return {
                type,
                content: anyMsg?.content,
                tool_calls: anyMsg?.tool_calls,
                invalid_tool_calls: anyMsg?.invalid_tool_calls,
                tool_call_id: anyMsg?.tool_call_id
            };
        });
    }

    private _estimateMessageChars(messages: BaseMessage[]) {
        let chars = 0;
        for (const m of messages) {
            const anyMsg = m as any;
            const content = anyMsg?.content;

            if (typeof content === "string") {
                chars += content.length;
                continue;
            }

            if (Array.isArray(content)) {
                for (const part of content) {
                    if (typeof part === "string") {
                        chars += part.length;
                    } else if (part && typeof part === "object" && typeof (part as any).text === "string") {
                        chars += (part as any).text.length;
                    } else if (part != null) {
                        try {
                            chars += JSON.stringify(part).length;
                        } catch {
                            // ignore
                        }
                    }
                }
                continue;
            }

            if (content != null) {
                try {
                    chars += JSON.stringify(content).length;
                } catch {
                    // ignore
                }
            }
        }
        return chars;
    }

    private _extractUsage(
        lastChunk: any,
        messages: BaseMessage[],
        completionText: string
    ): TokenUsage | undefined {
        const usageCandidates: any[] = [];

        if (lastChunk?.usage_metadata)
            usageCandidates.push({ source: "usage_metadata", value: lastChunk.usage_metadata });
        if (lastChunk?.response_metadata?.usage_metadata)
            usageCandidates.push({
                source: "response_metadata.usage_metadata",
                value: lastChunk.response_metadata.usage_metadata
            });
        if (lastChunk?.response_metadata?.usage)
            usageCandidates.push({ source: "response_metadata.usage", value: lastChunk.response_metadata.usage });
        if (lastChunk?.response_metadata?.tokenUsage)
            usageCandidates.push({
                source: "response_metadata.tokenUsage",
                value: lastChunk.response_metadata.tokenUsage
            });
        if (lastChunk?.additional_kwargs?.usage)
            usageCandidates.push({ source: "additional_kwargs.usage", value: lastChunk.additional_kwargs.usage });

        const normalize = (u: any): TokenUsage | undefined => {
            if (!u) return undefined;

            // LangChain usage_metadata
            if (
                typeof u.input_tokens === "number" ||
                typeof u.output_tokens === "number" ||
                typeof u.total_tokens === "number"
            ) {
                const promptTokens = Number(u.input_tokens || 0);
                const completionTokens = Number(u.output_tokens || 0);
                const totalTokens = Number(u.total_tokens || promptTokens + completionTokens);
                return { promptTokens, completionTokens, totalTokens };
            }

            // OpenAI-ish
            const promptTokens = Number(u.prompt_tokens ?? u.promptTokens ?? 0);
            const completionTokens = Number(u.completion_tokens ?? u.completionTokens ?? 0);
            const totalTokensRaw = u.total_tokens ?? u.totalTokens;
            const totalTokens = Number(totalTokensRaw ?? promptTokens + completionTokens);

            if ([promptTokens, completionTokens, totalTokens].some(n => Number.isNaN(n))) return undefined;
            if (promptTokens <= 0 && completionTokens <= 0 && totalTokens <= 0) return undefined;

            return {
                promptTokens: Math.max(0, promptTokens),
                completionTokens: Math.max(0, completionTokens),
                totalTokens: Math.max(0, totalTokens)
            };
        };

        let usage: TokenUsage | undefined;
        let pickedSource: string | undefined;

        for (const c of usageCandidates) {
            const normalized = normalize(c.value);
            if (normalized) {
                usage = normalized;
                pickedSource = c.source;
                break;
            }
        }

        if (!usage) return undefined;

        // Sanity check: provider 可能返回占位 token 数（例如 1/1/2），对较长 prompt 不可能成立
        const promptChars = this._estimateMessageChars(messages);
        const completionChars = completionText?.length ?? 0;

        const suspiciousPrompt = promptChars > 200 && usage.promptTokens <= 5;
        const suspiciousCompletion = completionChars > 80 && usage.completionTokens <= 5;
        const suspiciousTotal = promptChars + completionChars > 300 && usage.totalTokens <= 10;

        if (suspiciousPrompt || suspiciousCompletion || suspiciousTotal) {
            this.LOGGER.debug(
                `检测到可疑 token usage(可能为占位值)，忽略。source=${pickedSource}, usage=${util.inspect(usage)}`
            );
            return undefined;
        }

        // 补齐 totalTokens
        if (!usage.totalTokens || usage.totalTokens <= 0) {
            usage.totalTokens = usage.promptTokens + usage.completionTokens;
        }

        return usage;
    }

    public constructor(
        @inject(AI_MODEL_TOKENS.ToolRegistry) private toolRegistry: ToolRegistry,
        @inject(AI_MODEL_TOKENS.TextGeneratorService) private textGeneratorService: TextGeneratorService,
        @inject(AI_MODEL_TOKENS.VariableSpaceService) private variableSpaceService: VariableSpaceService
    ) {}

    /**
     * 执行 Agent（流式）
     * @param userMessage 用户消息
     * @param context 工具执行上下文
     * @param onChunk 流式 chunk 回调
     * @param config Agent 配置
     * @param historyMessages 历史消息
     * @param systemPrompt 系统提示词
     * @param modelName 模型名称（可选，默认使用配置中的第一个置顶模型）
     * @returns Agent 执行结果
     */
    public async executeStream(
        userMessage: string,
        context: ToolContext,
        onChunk: (chunk: AgentStreamChunk) => void,
        config: AgentConfig = {},
        historyMessages: ChatMessage[] = [],
        systemPrompt?: string,
        modelName?: string
    ): Promise<AgentResult> {
        // 获取模型名称（如果未指定，传入 undefined，TextGeneratorService 会自动使用配置中的默认值）
        const effectiveModelName = modelName;

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

        // 变量空间目录 message 的位置（用于每轮替换，避免 messages 膨胀）
        let variableDirectoryMessageIndex: number | null = null;

        // 添加系统提示词
        if (systemPrompt) {
            messages.push(new SystemMessage(systemPrompt));
        }

        // 预留一个“变量空间目录”系统消息位（仅在存在 sessionId 时启用）
        if (typeof context.sessionId === "string" && context.sessionId.trim().length > 0) {
            variableDirectoryMessageIndex = messages.length;
            messages.push(new SystemMessage("变量空间目录初始化中..."));
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
                // 在每轮 LLM 调用前刷新变量空间目录（只展示 key+summary，避免泄露大对象进 prompt）
                if (variableDirectoryMessageIndex !== null) {
                    const sessionId = context.sessionId as string;
                    const directoryText = await this.variableSpaceService.buildDirectoryForPrompt(sessionId, 30);
                    const directoryMessage = new SystemMessage(
                        "【统一变量空间（CAVM）】\n" +
                            directoryText +
                            "\n\n提示：\n" +
                            "1) 需要复用中间结果时请 var_set(key,value,summary)\n" +
                            "2) 需要读取具体内容时请 var_get(key)\n" +
                            "3) 需要查看目录时请 var_list(prefix,limit)\n" +
                            "4) 不再需要的临时变量可 var_delete(key)"
                    );
                    messages[variableDirectoryMessageIndex] = directoryMessage;
                }

                // 获取工具定义（每轮都需要传递）
                const tools = this.toolRegistry.getAllToolDefinitions();

                // 调试：打印工具定义与 messages（避免 [Object]）
                if (toolRounds === 1) {
                    this.LOGGER.info(`传递给 LLM 的工具: ${tools.map(t => t.function.name).join(", ")}`);
                    this.LOGGER.debug(
                        "发送给 LLM 的 messages: " +
                            util.inspect(this._formatMessagesForLog(messages), {
                                depth: null,
                                maxArrayLength: 50,
                                maxStringLength: 2000
                            })
                    );
                }

                // 调用 LLM（流式）
                const { content, toolCalls, usage } = await this._callLLMStream(
                    effectiveModelName,
                    messages,
                    tools,
                    onChunk,
                    config.temperature,
                    config.maxTokens,
                    config.abortSignal
                );

                this.LOGGER.debug(
                    "LLM本轮返回(摘要): " +
                        util.inspect(
                            {
                                hasToolCalls: toolCalls.length > 0,
                                toolCalls,
                                usage
                            },
                            { depth: null, maxArrayLength: 50, maxStringLength: 2000 }
                        )
                );

                // 累加 Token 使用量
                if (usage) {
                    totalUsage.promptTokens += usage.promptTokens;
                    totalUsage.completionTokens += usage.completionTokens;
                    totalUsage.totalTokens += usage.totalTokens;
                }

                // 如果没有工具调用，返回最终结果
                if (toolCalls.length === 0) {
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
                    const toolOutputForLLM = this._decorateToolOutputWithRef(
                        result.success ? result.result : { error: result.error },
                        result.archivedRef
                    );
                    messages.push(
                        new ToolMessage({
                            content: JSON.stringify(toolOutputForLLM),
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
        modelName: string | undefined,
        messages: BaseMessage[],
        tools: any[] | undefined,
        onChunk: (chunk: AgentStreamChunk) => void,
        temperature?: number,
        maxTokens?: number,
        abortSignal?: AbortSignal
    ): Promise<{ content: string; toolCalls: ToolCall[]; usage?: TokenUsage }> {
        let fullContent = "";
        const toolCalls: ToolCall[] = [];
        let lastChunk: any = null;

        // 使用 TextGeneratorService 的流式方法
        const stream = await this.textGeneratorService.streamWithMessages(
            modelName,
            messages,
            tools,
            temperature,
            maxTokens,
            abortSignal
        );

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
                this.LOGGER.debug(
                    "检测到原生工具调用: " +
                        util.inspect(chunk.tool_calls, { depth: null, maxArrayLength: 50, maxStringLength: 2000 })
                );
                for (const tc of chunk.tool_calls) {
                    toolCalls.push({
                        id: tc.id || crypto.randomUUID(),
                        name: tc.name,
                        arguments: tc.args as Record<string, unknown>
                    });
                }
            }
        }

        // 提取 Token 使用量（best-effort；遇到明显占位值会返回 undefined）
        const usage = this._extractUsage(lastChunk, messages, fullContent);

        // 如果没有检测到原生工具调用，尝试解析文本中的工具调用
        if (toolCalls.length === 0 && fullContent) {
            const parsedToolCalls = ToolCallParser.parseToolCalls(fullContent);
            if (parsedToolCalls.length > 0) {
                this.LOGGER.info(`从文本中解析出 ${parsedToolCalls.length} 个工具调用`);
                toolCalls.push(...parsedToolCalls);
            }
        }

        return { content: fullContent, toolCalls, usage };
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

            // 自动归档工具输出（用于 evidence.ref 可追溯）
            try {
                const archivedRef = await this._archiveToolExecution(toolCall, context, {
                    success: result.success,
                    result: result.result,
                    error: result.error
                });
                if (archivedRef) {
                    result.archivedRef = archivedRef;
                }
            } catch (error) {
                const require = this._shouldRequireEvidenceRef(context);
                this.LOGGER.error(`工具输出归档失败(tool=${toolCall.name}, require=${require}): ${error}`);
                if (require) {
                    throw error;
                }
            }

            results.push(result);

            // 发送工具结果事件
            const toolOutputForEvent = this._decorateToolOutputWithRef(
                result.success ? result.result : { error: result.error },
                result.archivedRef
            );
            onChunk({
                type: "tool_result",
                toolName: toolCall.name,
                toolResult: toolOutputForEvent
            });
        }

        return results;
    }
}
