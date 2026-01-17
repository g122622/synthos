import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import { ChatOpenAI } from "@langchain/openai";
import { BaseMessage } from "@langchain/core/messages";
import ErrorReasons from "@root/common/contracts/ErrorReasons";
import Logger from "@root/common/util/Logger";
import { Disposable } from "@root/common/util/lifecycle/Disposable";
import { mustInitBeforeUse } from "@root/common/util/lifecycle/mustInitBeforeUse";
import { duplicateElements } from "@root/common/util/core/duplicateElements";
import { sleep } from "@root/common/util/promisify/sleep";
import { COMMON_TOKENS } from "@root/common/di/tokens";

/**
 * 文本生成器
 * 提供基于 LLM 的文本生成能力，支持多模型候选和重试机制
 */
@injectable()
@mustInitBeforeUse
export class TextGeneratorService extends Disposable {
    private models = new Map<string, ChatOpenAI>();
    private activeModel: ChatOpenAI | null = null;
    private LOGGER = Logger.withTag("TextGeneratorService");

    /**
     * 构造函数
     * @param configManagerService 配置管理服务
     */
    public constructor(
        @inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService
    ) {
        super();
    }

    /**
     * 初始化文本生成器
     */
    public async init() {
        this._registerDisposableFunction(() => {
            // LangChain 的 ChatOpenAI 通常不需要显式关闭，但可以清空模型缓存
            this.models.clear();
            this.activeModel = null;
        });
        // 可选：预加载默认模型，或留空由 useModel 懒加载
    }

    private async useModel(modelName: string) {
        // 懒加载：当需要使用某个模型时才创建实例
        if (!this.models.has(modelName)) {
            const config = await this.configManagerService.getCurrentConfig();
            const chatModel = new ChatOpenAI({
                openAIApiKey: config.ai?.models[modelName]?.apiKey ?? config.ai.defaultModelConfig.apiKey, // 从配置中获取 API Key
                apiKey: config.ai?.models[modelName]?.apiKey ?? config.ai.defaultModelConfig.apiKey, // 从配置中获取 API Key
                configuration: {
                    baseURL: config.ai?.models[modelName]?.baseURL ?? config.ai.defaultModelConfig.baseURL // 支持自定义 base URL
                },
                model: modelName,
                temperature: config.ai?.models[modelName]?.temperature ?? config.ai.defaultModelConfig.temperature,
                maxTokens: config.ai?.models[modelName]?.maxTokens ?? config.ai.defaultModelConfig.maxTokens,
                reasoning: {
                    effort: "minimal" // 默认不思考
                }
            });
            this.models.set(modelName, chatModel);
            this.LOGGER.info(`Model ${modelName} 成功加载.`);
        }
        this.activeModel = this.models.get(modelName)!;
    }

    /**
     * 生成文本
     * @param modelName 模型名称
     * @param input 用户输入
     * @returns 生成的文本
     */
    private async doGenerateText(modelName: string, input: string): Promise<string> {
        try {
            await this.useModel(modelName);
            if (!this.activeModel) {
                throw ErrorReasons.UNINITIALIZED_ERROR;
            }

            const response = await this.activeModel.invoke([{ role: "user", content: input }]);

            return response.content as string;
        } catch (error) {
            this.LOGGER.error(`Error generating text with model ${modelName} : ` + error);
            console.error(error);
            throw error;
        }
    }

    /**
     * 生成文本。内部使用langchain的流式特性，但是对外的行为和doGenerateText一致。
     * @param modelName 模型名称
     * @param input 用户输入
     * @returns 生成的文本流
     */
    private async doGenerateTextStream(modelName: string, input: string): Promise<string> {
        try {
            await this.useModel(modelName);
            if (!this.activeModel) {
                throw ErrorReasons.UNINITIALIZED_ERROR;
            }

            let fullContent = "";
            const stream = await this.activeModel.stream([{ role: "user", content: input }]);

            for await (const chunk of stream) {
                // chunk 是 AIMessageChunk，其 content 是字符串片段
                if (typeof chunk.content === "string") {
                    fullContent += chunk.content;
                }
            }

            return fullContent;
        } catch (error) {
            this.LOGGER.error(`Error generating text (stream) with model ${modelName}: ${error}`);
            console.error(error);
            throw error;
        }
    }

    /**
     * 无状态的、带重试机制的、带候选机制的文本生成方法
     * @param modelNames 模型候选列表，允许为空。如果为空，则只使用置顶的的模型候选列表
     * @param input 输入文本
     * @param 是否对输出强校验json格式
     * @returns
     */
    public async generateTextWithModelCandidates(
        modelNames: string[],
        input: string,
        checkJsonFormat: boolean = false
    ): Promise<{
        selectedModelName: string;
        content: string;
    }> {
        const config = await this.configManagerService.getCurrentConfig();
        // 从第一个开始尝试，如果失败了就会尝试下一个
        const modelCandidates = [
            ...duplicateElements(config.ai.pinnedModels, 2), // 失败重复机制：每个模型重复2次
            ...modelNames
        ];
        let resultStr = "";
        let selectedModelName = "";
        for (const modelName of modelCandidates) {
            try {
                resultStr = await this.doGenerateTextStream(modelName, input);
                if (resultStr) {
                    // 尝试parseJson，如果不符合json格式，会直接抛错
                    if (checkJsonFormat) {
                        JSON.parse(resultStr);
                    }
                    selectedModelName = modelName;
                    break; // 如果成功，跳出循环
                } else {
                    throw new Error(`生成的摘要为空`);
                }
            } catch (error) {
                this.LOGGER.error(`模型 ${modelName} 生成摘要失败，错误信息为：${error}, 尝试下一个模型`);
                await sleep(10000); // 等待10秒
                continue; // 跳过当前模型，尝试下一个
            }
        }
        if (!resultStr) {
            throw new Error(`所有模型都生成摘要失败，跳过`);
        }
        return {
            selectedModelName,
            content: resultStr
        };
    }

    /**
     * 获取指定模型的 ChatOpenAI 实例（用于高级场景，如 Agent 的 Function Calling）
     * @param modelName 模型名称
     * @param temperature 温度参数（可选）
     * @param maxTokens 最大 token 数（可选）
     * @returns ChatOpenAI 实例
     */
    public async getChatModel(modelName: string, temperature?: number, maxTokens?: number): Promise<ChatOpenAI> {
        const config = await this.configManagerService.getCurrentConfig();

        // 创建新的 ChatOpenAI 实例（不缓存，因为参数可能不同）
        const chatModel = new ChatOpenAI({
            openAIApiKey: config.ai?.models[modelName]?.apiKey ?? config.ai.defaultModelConfig.apiKey,
            apiKey: config.ai?.models[modelName]?.apiKey ?? config.ai.defaultModelConfig.apiKey,
            configuration: {
                baseURL: config.ai?.models[modelName]?.baseURL ?? config.ai.defaultModelConfig.baseURL
            },
            model: modelName,
            temperature:
                temperature ??
                config.ai?.models[modelName]?.temperature ??
                config.ai.defaultModelConfig.temperature,
            maxTokens:
                maxTokens ?? config.ai?.models[modelName]?.maxTokens ?? config.ai.defaultModelConfig.maxTokens,
            reasoning: {
                effort: "minimal"
            }
        });

        this.LOGGER.info(`为 Agent 场景创建独立的 ChatOpenAI 实例: ${modelName}`);
        return chatModel;
    }

    /**
     * 使用消息列表生成文本（流式，支持工具绑定）
     * 适用于 Agent 等需要复杂消息历史和工具调用的场景
     * @param modelName 模型名称（如果未指定或为 "default"，则使用配置中的第一个置顶模型）
     * @param messages 消息列表
     * @param tools 工具定义（可选）
     * @param temperature 温度参数（可选）
     * @param maxTokens 最大 token 数（可选）
     * @param abortSignal 中止信号（可选）
     * @returns 异步迭代器，产出文本片段
     */
    public async streamWithMessages(
        modelName: string | undefined,
        messages: BaseMessage[],
        tools?: any[],
        temperature?: number,
        maxTokens?: number,
        abortSignal?: AbortSignal
    ): Promise<AsyncIterableIterator<any>> {
        const config = await this.configManagerService.getCurrentConfig();

        // 如果未指定模型或指定为 "default"，使用配置中的第一个置顶模型
        const effectiveModelName =
            !modelName || modelName === "default" ? config.ai.pinnedModels[0] || "gpt-4" : modelName;

        this.LOGGER.info(`Agent 使用模型: ${effectiveModelName}`);

        // 创建独立的模型实例
        let chatModel = new ChatOpenAI({
            openAIApiKey: config.ai?.models[effectiveModelName]?.apiKey ?? config.ai.defaultModelConfig.apiKey,
            apiKey: config.ai?.models[effectiveModelName]?.apiKey ?? config.ai.defaultModelConfig.apiKey,
            configuration: {
                baseURL: config.ai?.models[effectiveModelName]?.baseURL ?? config.ai.defaultModelConfig.baseURL
            },
            model: effectiveModelName,
            temperature:
                temperature ??
                config.ai?.models[effectiveModelName]?.temperature ??
                config.ai.defaultModelConfig.temperature,
            maxTokens:
                maxTokens ??
                config.ai?.models[effectiveModelName]?.maxTokens ??
                config.ai.defaultModelConfig.maxTokens,
            reasoning: {
                effort: "minimal"
            }
        });

        // 如果提供了工具，绑定工具并返回流
        if (tools && tools.length > 0) {
            this.LOGGER.info(`绑定 ${tools.length} 个工具到 ChatModel`);
            // 使用 bindTools 绑定工具，并通过 stream 的第二个参数传递 tool_choice
            const boundModel = chatModel.bindTools(tools);
            this.LOGGER.info(`尝试启用强制工具调用模式 (tool_choice: "auto")`);
            return boundModel.stream(messages, {
                signal: abortSignal
                // 注意：部分模型可能不支持 tool_choice，需要测试
            });
        }

        // 返回流式迭代器
        return chatModel.stream(messages, { signal: abortSignal });
    }
}
