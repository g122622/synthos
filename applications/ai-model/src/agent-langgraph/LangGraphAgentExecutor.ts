/**
 * LangGraph 版本 Agent 执行器
 * 使用 LangGraph Graph API 实现 tool-calling 循环，并接入 checkpointer 实现持久化/时间旅行/HITL。
 */
import "reflect-metadata";
import util from "util";
import { injectable, inject } from "tsyringe";
import { Annotation, StateGraph, messagesStateReducer, START, END } from "@langchain/langgraph";
import { AIMessage, HumanMessage, SystemMessage, ToolMessage, BaseMessage } from "@langchain/core/messages";
import Logger from "@root/common/util/Logger";
import { AI_MODEL_TOKENS } from "../di/tokens";
import type {
    AgentConfig,
    AgentResult,
    AgentStreamChunk,
    ToolCall,
    ToolContext,
    TokenUsage
} from "../agent/contracts/index";
import { TextGeneratorService } from "../services/generators/text/TextGeneratorService";
import { AgentToolCatalog } from "./AgentToolCatalog";
import { LangGraphCheckpointerService } from "./LangGraphCheckpointerService";
import { ToolCallParser } from "../agent/utils/ToolCallParser";

interface AgentGraphState {
    messages: BaseMessage[];
    systemPrompt: string;
    enabledTools: string[];
    maxToolRounds: number;
    toolContext: ToolContext;

    // 每次 invoke 的运行态统计（会在每次调用时重置）
    runToolRounds: number;
    runToolsUsed: string[];
    runTotalUsage: TokenUsage;
}

@injectable()
export class LangGraphAgentExecutor {
    private LOGGER = Logger.withTag("LangGraphAgentExecutor");

    public constructor(
        @inject(AI_MODEL_TOKENS.TextGeneratorService) private textGeneratorService: TextGeneratorService,
        @inject(AI_MODEL_TOKENS.AgentToolCatalog) private agentToolCatalog: AgentToolCatalog,
        @inject(AI_MODEL_TOKENS.LangGraphCheckpointerService)
        private checkpointerService: LangGraphCheckpointerService
    ) {}

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

        if (lastChunk?.usage_metadata) {
            usageCandidates.push({ source: "usage_metadata", value: lastChunk.usage_metadata });
        }
        if (lastChunk?.response_metadata?.usage_metadata) {
            usageCandidates.push({
                source: "response_metadata.usage_metadata",
                value: lastChunk.response_metadata.usage_metadata
            });
        }
        if (lastChunk?.response_metadata?.usage) {
            usageCandidates.push({ source: "response_metadata.usage", value: lastChunk.response_metadata.usage });
        }
        if (lastChunk?.response_metadata?.tokenUsage) {
            usageCandidates.push({
                source: "response_metadata.tokenUsage",
                value: lastChunk.response_metadata.tokenUsage
            });
        }
        if (lastChunk?.additional_kwargs?.usage) {
            usageCandidates.push({ source: "additional_kwargs.usage", value: lastChunk.additional_kwargs.usage });
        }

        const normalize = (u: any): TokenUsage | undefined => {
            if (!u) {
                return undefined;
            }

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

            if ([promptTokens, completionTokens, totalTokens].some(n => Number.isNaN(n))) {
                return undefined;
            }
            if (promptTokens <= 0 && completionTokens <= 0 && totalTokens <= 0) {
                return undefined;
            }

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

        if (!usage) {
            return undefined;
        }

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

        if (!usage.totalTokens || usage.totalTokens <= 0) {
            usage.totalTokens = usage.promptTokens + usage.completionTokens;
        }

        return usage;
    }

    private _mergeUsage(base: TokenUsage, delta: TokenUsage | undefined): TokenUsage {
        if (!delta) {
            return base;
        }

        return {
            promptTokens: base.promptTokens + delta.promptTokens,
            completionTokens: base.completionTokens + delta.completionTokens,
            totalTokens: base.totalTokens + delta.totalTokens
        };
    }

    private _createEmptyUsage(): TokenUsage {
        return {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0
        };
    }

    private _addUnique(arr: string[], item: string): string[] {
        if (arr.includes(item)) {
            return arr;
        }
        return [...arr, item];
    }

    private async _callLLMStream(args: {
        messages: BaseMessage[];
        tools: any[];
        enabledTools: string[];
        onChunk: (chunk: AgentStreamChunk) => void;
        temperature: number | undefined;
        maxTokens: number | undefined;
        abortSignal: AbortSignal | undefined;
    }): Promise<{ content: string; toolCalls: ToolCall[]; usage?: TokenUsage }> {
        let fullContent = "";
        const toolCalls: ToolCall[] = [];
        let lastChunk: any = null;

        const stream = await this.textGeneratorService.streamWithMessages(
            undefined,
            args.messages,
            args.tools,
            args.temperature,
            args.maxTokens,
            args.abortSignal
        );

        for await (const chunk of stream) {
            lastChunk = chunk;

            if (args.abortSignal?.aborted) {
                break;
            }

            if (typeof chunk.content === "string" && chunk.content) {
                fullContent += chunk.content;
                args.onChunk({ type: "content", content: chunk.content });
            }

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

        const usage = this._extractUsage(lastChunk, args.messages, fullContent);

        // 兼容：部分模型/渠道不支持原生 tool_calls，沿用旧实现的“文本工具调用”兜底
        if (toolCalls.length === 0 && fullContent) {
            const parsed = ToolCallParser.parseToolCalls(fullContent);
            if (parsed.length > 0) {
                const filtered = parsed.filter(tc => args.enabledTools.includes(tc.name));
                if (filtered.length > 0) {
                    this.LOGGER.info(`从文本中解析到 ${filtered.length} 个工具调用(已按 enabledTools 过滤)`);
                    toolCalls.push(...filtered);
                }
            }
        }

        return { content: fullContent, toolCalls, usage };
    }

    /**
     * 执行 Agent（流式）
     * 兼容旧版签名：historyMessages 参数会被忽略（对话历史由 checkpointer + thread_id 维护）。
     */
    public async executeStream(
        userMessage: string,
        context: ToolContext,
        onChunk: (chunk: AgentStreamChunk) => void,
        config: AgentConfig = {},
        historyMessages: { role: string; content: string }[] = [],
        systemPrompt?: string,
        modelName?: string
    ): Promise<AgentResult> {
        void historyMessages;
        void modelName;

        const maxToolRounds = config.maxToolRounds ?? 5;
        const enabledTools = config.enabledTools ?? [];

        const initialUsage: TokenUsage = this._createEmptyUsage();

        const AgentState = Annotation.Root({
            messages: Annotation<BaseMessage[]>({
                reducer: messagesStateReducer,
                default: () => []
            }),
            systemPrompt: Annotation<string>,
            enabledTools: Annotation<string[]>,
            maxToolRounds: Annotation<number>,
            toolContext: Annotation<ToolContext>,
            runToolRounds: Annotation<number>,
            runToolsUsed: Annotation<string[]>,
            runTotalUsage: Annotation<TokenUsage>
        });

        const llmCall = async (state: AgentGraphState): Promise<Partial<AgentGraphState>> => {
            if (config.abortSignal?.aborted) {
                throw new Error("执行被用户中止");
            }

            const tools = this.agentToolCatalog.getEnabledToolDefinitions(state.enabledTools);

            const promptMessages: BaseMessage[] = [];
            if (state.systemPrompt) {
                promptMessages.push(new SystemMessage(state.systemPrompt));
            }
            promptMessages.push(...state.messages);

            if (state.runToolRounds === 0) {
                this.LOGGER.info(`本轮启用工具: ${tools.map(t => t.function.name).join(", ") || "无"}`);
                this.LOGGER.debug(
                    "发送给 LLM 的 messages: " +
                        util.inspect(this._formatMessagesForLog(promptMessages), {
                            depth: null,
                            maxArrayLength: 50,
                            maxStringLength: 2000
                        })
                );
            }

            const { content, toolCalls, usage } = await this._callLLMStream({
                messages: promptMessages,
                tools,
                enabledTools: state.enabledTools,
                onChunk,
                temperature: config.temperature,
                maxTokens: config.maxTokens,
                abortSignal: config.abortSignal
            });

            const aiMessage = new AIMessage({
                content: content || "",
                tool_calls: toolCalls.map(tc => ({
                    id: tc.id,
                    name: tc.name,
                    args: tc.arguments
                }))
            });

            return {
                messages: [aiMessage],
                runToolRounds: state.runToolRounds + 1,
                runTotalUsage: this._mergeUsage(state.runTotalUsage, usage)
            };
        };

        const toolNode = async (state: AgentGraphState): Promise<Partial<AgentGraphState>> => {
            const lastMessage = state.messages.at(-1);
            if (!lastMessage || !AIMessage.isInstance(lastMessage)) {
                return {};
            }

            const toolCalls = lastMessage.tool_calls ?? [];
            if (toolCalls.length === 0) {
                return {};
            }

            const toolMessages: ToolMessage[] = [];
            let toolsUsed = state.runToolsUsed;

            for (const tc of toolCalls) {
                if (config.abortSignal?.aborted) {
                    throw new Error("执行被用户中止");
                }

                const toolName = tc.name;
                const toolArgs = (tc.args || {}) as Record<string, unknown>;
                const toolCallId = tc.id || crypto.randomUUID();

                // tool_start
                onChunk({ type: "tool_start", toolName, toolParams: toolArgs });

                try {
                    const result = await this.agentToolCatalog.executeTool(
                        toolName,
                        toolArgs,
                        state.toolContext,
                        state.enabledTools
                    );

                    toolsUsed = this._addUnique(toolsUsed, toolName);

                    toolMessages.push(
                        new ToolMessage({
                            content: JSON.stringify(result),
                            tool_call_id: toolCallId
                        })
                    );

                    // tool_result
                    onChunk({ type: "tool_result", toolName, toolResult: result });
                } catch (e) {
                    const errorMessage = e instanceof Error ? e.message : String(e);
                    toolMessages.push(
                        new ToolMessage({
                            content: JSON.stringify({ error: errorMessage }),
                            tool_call_id: toolCallId
                        })
                    );
                    onChunk({ type: "tool_result", toolName, toolResult: { error: errorMessage } });
                }
            }

            return {
                messages: toolMessages,
                runToolsUsed: toolsUsed
            };
        };

        const maxRoundsNode = async (): Promise<Partial<AgentGraphState>> => {
            return {
                messages: [new AIMessage("已达到最大工具调用轮数限制，请简化问题或重新提问。")]
            };
        };

        const shouldContinue = (state: AgentGraphState): "toolNode" | "maxRounds" | typeof END => {
            const lastMessage = state.messages.at(-1);
            if (!lastMessage || !AIMessage.isInstance(lastMessage)) {
                return END;
            }

            if (state.runToolRounds >= state.maxToolRounds) {
                return "maxRounds";
            }

            if (lastMessage.tool_calls?.length) {
                return "toolNode";
            }

            return END;
        };

        const workflow = new StateGraph(AgentState)
            .addNode("llmCall", llmCall as any)
            .addNode("toolNode", toolNode as any)
            .addNode("maxRounds", maxRoundsNode as any)
            .addEdge(START, "llmCall")
            .addConditionalEdges("llmCall", shouldContinue as any, ["toolNode", "maxRounds", END])
            .addEdge("toolNode", "llmCall")
            .addEdge("maxRounds", END);

        const checkpointer = await this.checkpointerService.getCheckpointer();
        const graph = workflow.compile({ checkpointer });

        // 使用 conversationId 作为 thread_id（LangGraph 的持久化主键）
        const threadId = String(context.conversationId || context.sessionId || crypto.randomUUID());

        try {
            const resultState = (await graph.invoke(
                {
                    messages: [new HumanMessage(userMessage)],
                    systemPrompt: systemPrompt || "",
                    enabledTools,
                    maxToolRounds,
                    toolContext: context,
                    runToolRounds: 0,
                    runToolsUsed: [],
                    runTotalUsage: initialUsage
                },
                {
                    configurable: {
                        thread_id: threadId
                    }
                }
            )) as AgentGraphState;

            const last = resultState.messages.at(-1);
            const finalContent = last && AIMessage.isInstance(last) ? String((last as any).content || "") : "";

            onChunk({ type: "done", isFinished: true, usage: resultState.runTotalUsage });

            return {
                content: finalContent,
                toolsUsed: resultState.runToolsUsed,
                toolRounds: resultState.runToolRounds,
                totalUsage: resultState.runTotalUsage
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.LOGGER.error(`Agent 执行出错: ${msg}`);
            onChunk({ type: "error", error: msg });
            throw error;
        }
    }
}
