import "reflect-metadata";
import { getConfigManagerService } from "@root/common/di/container";
import { ChatOpenAI } from "@langchain/openai";
import ErrorReasons from "@root/common/contracts/ErrorReasons";
import Logger from "@root/common/util/Logger";
import { Disposable } from "@root/common/util/lifecycle/Disposable";
import { mustInitBeforeUse } from "@root/common/util/lifecycle/mustInitBeforeUse";

@mustInitBeforeUse
export class TextGenerator extends Disposable {
    private models = new Map<string, ChatOpenAI>();
    private activeModel: ChatOpenAI | null = null;
    private LOGGER = Logger.withTag("TextGenerator");

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
            const config = await getConfigManagerService().getCurrentConfig();
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

    public async generateText(modelName: string, input: string): Promise<string> {
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
}
