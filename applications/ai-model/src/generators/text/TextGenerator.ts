import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import { ChatOpenAI } from "@langchain/openai";
import ErrorReasons from "@root/common/contracts/ErrorReasons";
import Logger from "@root/common/util/Logger";
import { Disposable } from "@root/common/util/lifecycle/Disposable";
import { mustInitBeforeUse } from "@root/common/util/lifecycle/mustInitBeforeUse";
import { duplicateElements } from "@root/common/util/core/duplicateElements";
import { sleep } from "@root/common/util/promisify/sleep";
import { AI_MODEL_TOKENS } from "../../di/tokens";

/**
 * 文本生成器
 * 提供基于 LLM 的文本生成能力，支持多模型候选和重试机制
 */
@injectable()
@mustInitBeforeUse
export class TextGenerator extends Disposable {
    private models = new Map<string, ChatOpenAI>();
    private activeModel: ChatOpenAI | null = null;
    private LOGGER = Logger.withTag("TextGenerator");

    /**
     * 构造函数
     * @param configManagerService 配置管理服务
     */
    public constructor(
        @inject(AI_MODEL_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService
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
                openAIApiKey:
                    config.ai?.models[modelName]?.apiKey ?? config.ai.defaultModelConfig.apiKey, // 从配置中获取 API Key
                apiKey: config.ai?.models[modelName]?.apiKey ?? config.ai.defaultModelConfig.apiKey, // 从配置中获取 API Key
                configuration: {
                    baseURL:
                        config.ai?.models[modelName]?.baseURL ??
                        config.ai.defaultModelConfig.baseURL // 支持自定义 base URL
                },
                model: modelName,
                temperature:
                    config.ai?.models[modelName]?.temperature ??
                    config.ai.defaultModelConfig.temperature,
                maxTokens:
                    config.ai?.models[modelName]?.maxTokens ??
                    config.ai.defaultModelConfig.maxTokens,
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
                this.LOGGER.error(
                    `模型 ${modelName} 生成摘要失败，错误信息为：${error}, 尝试下一个模型`
                );
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
}
