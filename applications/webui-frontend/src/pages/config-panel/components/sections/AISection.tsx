/**
 * AI 配置区域
 */
import type { SectionProps } from "../../types";

import React from "react";

import { getNestedValue } from "../../utils";
import { StringInput, NumberInput, StringArrayEditor } from "../inputs";
import { RecordEditor } from "../editors";

/**
 * 获取字段错误
 */
const getFieldError = (errors: SectionProps["errors"], path: string): string | undefined => {
    const error = errors.find(e => e.path === path);

    return error?.message;
};

const AISection: React.FC<SectionProps> = ({ config, errors, onFieldChange }) => {
    return (
        <div className="space-y-6">
            <div>
                <h4 className="text-md font-semibold mb-4">模型配置</h4>
                <RecordEditor
                    errors={errors}
                    itemSchema="ModelConfig"
                    path="ai.models"
                    value={(getNestedValue(config, "ai.models") as Record<string, unknown>) || {}}
                    onChange={onFieldChange}
                    onFieldChange={onFieldChange}
                />
            </div>

            <div>
                <h4 className="text-md font-semibold mb-4">默认模型配置</h4>
                <div className="grid gap-4">
                    <StringInput
                        description="API 密钥"
                        error={getFieldError(errors, "ai.defaultModelConfig.apiKey")}
                        label="API 密钥"
                        path="ai.defaultModelConfig.apiKey"
                        value={(getNestedValue(config, "ai.defaultModelConfig.apiKey") as string) || ""}
                        onChange={onFieldChange}
                    />
                    <StringInput
                        description="API 基础 URL"
                        error={getFieldError(errors, "ai.defaultModelConfig.baseURL")}
                        label="API 基础 URL"
                        path="ai.defaultModelConfig.baseURL"
                        value={(getNestedValue(config, "ai.defaultModelConfig.baseURL") as string) || ""}
                        onChange={onFieldChange}
                    />
                    <NumberInput
                        description="温度参数，控制输出的随机性"
                        error={getFieldError(errors, "ai.defaultModelConfig.temperature")}
                        label="温度参数"
                        max={2}
                        min={0}
                        path="ai.defaultModelConfig.temperature"
                        value={(getNestedValue(config, "ai.defaultModelConfig.temperature") as number) || 0}
                        onChange={onFieldChange}
                    />
                    <NumberInput
                        description="最大 Token 数量"
                        error={getFieldError(errors, "ai.defaultModelConfig.maxTokens")}
                        label="最大 Token 数量"
                        min={1}
                        path="ai.defaultModelConfig.maxTokens"
                        value={(getNestedValue(config, "ai.defaultModelConfig.maxTokens") as number) || 0}
                        onChange={onFieldChange}
                    />
                </div>
            </div>

            <div>
                <h4 className="text-md font-semibold mb-4">基本设置</h4>
                <div className="grid gap-4">
                    <StringInput
                        description="默认模型名称"
                        error={getFieldError(errors, "ai.defaultModelName")}
                        label="默认模型名称"
                        path="ai.defaultModelName"
                        value={(getNestedValue(config, "ai.defaultModelName") as string) || ""}
                        onChange={onFieldChange}
                    />
                    <StringArrayEditor
                        description="固定模型列表"
                        label="固定模型列表"
                        path="ai.pinnedModels"
                        value={(getNestedValue(config, "ai.pinnedModels") as string[]) || []}
                        onChange={onFieldChange}
                    />
                </div>
            </div>

            <div>
                <h4 className="text-md font-semibold mb-4">兴趣度评分配置</h4>
                <div className="grid gap-4">
                    <StringArrayEditor
                        description="正向关键词"
                        label="正向关键词"
                        path="ai.interestScore.UserInterestsPositiveKeywords"
                        value={(getNestedValue(config, "ai.interestScore.UserInterestsPositiveKeywords") as string[]) || []}
                        onChange={onFieldChange}
                    />
                    <StringArrayEditor
                        description="负向关键词"
                        label="负向关键词"
                        path="ai.interestScore.UserInterestsNegativeKeywords"
                        value={(getNestedValue(config, "ai.interestScore.UserInterestsNegativeKeywords") as string[]) || []}
                        onChange={onFieldChange}
                    />
                </div>
            </div>

            <div>
                <h4 className="text-md font-semibold mb-4">向量嵌入配置</h4>
                <div className="grid gap-4">
                    <StringInput
                        description="embedding 服务base地址，如 http://localhost:11434"
                        error={getFieldError(errors, "ai.embedding.ollamaBaseURL")}
                        label="Ollama Base URL"
                        path="ai.embedding.ollamaBaseURL"
                        value={(getNestedValue(config, "ai.embedding.ollamaBaseURL") as string) || ""}
                        onChange={onFieldChange}
                    />
                    <StringInput
                        description="嵌入模型名"
                        error={getFieldError(errors, "ai.embedding.model")}
                        label="嵌入模型名"
                        path="ai.embedding.model"
                        value={(getNestedValue(config, "ai.embedding.model") as string) || ""}
                        onChange={onFieldChange}
                    />
                    <NumberInput
                        description="批量处理大小"
                        error={getFieldError(errors, "ai.embedding.batchSize")}
                        label="批量处理大小"
                        min={1}
                        path="ai.embedding.batchSize"
                        value={(getNestedValue(config, "ai.embedding.batchSize") as number) || 0}
                        onChange={onFieldChange}
                    />
                    <StringInput
                        description="向量数据库路径"
                        error={getFieldError(errors, "ai.embedding.vectorDBPath")}
                        label="向量数据库路径"
                        path="ai.embedding.vectorDBPath"
                        value={(getNestedValue(config, "ai.embedding.vectorDBPath") as string) || ""}
                        onChange={onFieldChange}
                    />
                    <NumberInput
                        description="向量维度"
                        error={getFieldError(errors, "ai.embedding.dimension")}
                        label="向量维度"
                        min={1}
                        path="ai.embedding.dimension"
                        value={(getNestedValue(config, "ai.embedding.dimension") as number) || 0}
                        onChange={onFieldChange}
                    />
                </div>
            </div>

            <div>
                <h4 className="text-md font-semibold mb-4">RPC 服务配置</h4>
                <div className="grid gap-4">
                    <NumberInput
                        description="RPC 服务端口"
                        error={getFieldError(errors, "ai.rpc.port")}
                        label="RPC 服务端口"
                        max={65535}
                        min={1}
                        path="ai.rpc.port"
                        value={(getNestedValue(config, "ai.rpc.port") as number) || 0}
                        onChange={onFieldChange}
                    />
                </div>
            </div>
        </div>
    );
};

export default AISection;
