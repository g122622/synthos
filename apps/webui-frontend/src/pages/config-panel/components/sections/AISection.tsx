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
                    <div className="space-y-1">
                        <label className="text-sm font-medium">API 密钥</label>
                        <StringInput
                            description="API 密钥"
                            error={getFieldError(errors, "ai.defaultModelConfig.apiKey")}
                            path="ai.defaultModelConfig.apiKey"
                            value={(getNestedValue(config, "ai.defaultModelConfig.apiKey") as string) || ""}
                            onChange={onFieldChange}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium">API 基础 URL</label>
                        <StringInput
                            description="API 基础 URL"
                            error={getFieldError(errors, "ai.defaultModelConfig.baseURL")}
                            path="ai.defaultModelConfig.baseURL"
                            value={(getNestedValue(config, "ai.defaultModelConfig.baseURL") as string) || ""}
                            onChange={onFieldChange}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium">温度参数</label>
                        <NumberInput
                            description="温度参数，控制输出的随机性"
                            error={getFieldError(errors, "ai.defaultModelConfig.temperature")}
                            max={2}
                            min={0}
                            path="ai.defaultModelConfig.temperature"
                            value={(getNestedValue(config, "ai.defaultModelConfig.temperature") as number) || 0}
                            onChange={onFieldChange}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium">最大 Token 数量</label>
                        <NumberInput
                            description="最大 Token 数量"
                            error={getFieldError(errors, "ai.defaultModelConfig.maxTokens")}
                            min={1}
                            path="ai.defaultModelConfig.maxTokens"
                            value={(getNestedValue(config, "ai.defaultModelConfig.maxTokens") as number) || 0}
                            onChange={onFieldChange}
                        />
                    </div>
                </div>
            </div>

            <div>
                <h4 className="text-md font-semibold mb-4">基本设置</h4>
                <div className="grid gap-4">
                    <div className="space-y-1">
                        <label className="text-sm font-medium">默认模型名称</label>
                        <StringInput
                            description="默认模型名称"
                            error={getFieldError(errors, "ai.defaultModelName")}
                            path="ai.defaultModelName"
                            value={(getNestedValue(config, "ai.defaultModelName") as string) || ""}
                            onChange={onFieldChange}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium">固定模型列表</label>
                        <StringArrayEditor description="固定模型列表" path="ai.pinnedModels" value={(getNestedValue(config, "ai.pinnedModels") as string[]) || []} onChange={onFieldChange} />
                    </div>
                </div>
            </div>

            <div>
                <h4 className="text-md font-semibold mb-4">兴趣度评分配置</h4>
                <div className="grid gap-4">
                    <div className="space-y-1">
                        <label className="text-sm font-medium">正向关键词</label>
                        <StringArrayEditor
                            description="正向关键词"
                            path="ai.interestScore.UserInterestsPositiveKeywords"
                            value={(getNestedValue(config, "ai.interestScore.UserInterestsPositiveKeywords") as string[]) || []}
                            onChange={onFieldChange}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium">负向关键词</label>
                        <StringArrayEditor
                            description="负向关键词"
                            path="ai.interestScore.UserInterestsNegativeKeywords"
                            value={(getNestedValue(config, "ai.interestScore.UserInterestsNegativeKeywords") as string[]) || []}
                            onChange={onFieldChange}
                        />
                    </div>
                </div>
            </div>

            <div>
                <h4 className="text-md font-semibold mb-4">向量嵌入配置</h4>
                <div className="grid gap-4">
                    <div className="space-y-1">
                        <label className="text-sm font-medium">Ollama Base URL</label>
                        <StringInput
                            description="embedding 服务base地址，如 http://localhost:11434"
                            error={getFieldError(errors, "ai.embedding.ollamaBaseURL")}
                            path="ai.embedding.ollamaBaseURL"
                            value={(getNestedValue(config, "ai.embedding.ollamaBaseURL") as string) || ""}
                            onChange={onFieldChange}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium">嵌入模型名</label>
                        <StringInput
                            description="嵌入模型名"
                            error={getFieldError(errors, "ai.embedding.model")}
                            path="ai.embedding.model"
                            value={(getNestedValue(config, "ai.embedding.model") as string) || ""}
                            onChange={onFieldChange}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium">批量处理大小</label>
                        <NumberInput
                            description="批量处理大小"
                            error={getFieldError(errors, "ai.embedding.batchSize")}
                            min={1}
                            path="ai.embedding.batchSize"
                            value={(getNestedValue(config, "ai.embedding.batchSize") as number) || 0}
                            onChange={onFieldChange}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium">向量数据库路径</label>
                        <StringInput
                            description="向量数据库路径"
                            error={getFieldError(errors, "ai.embedding.vectorDBPath")}
                            path="ai.embedding.vectorDBPath"
                            value={(getNestedValue(config, "ai.embedding.vectorDBPath") as string) || ""}
                            onChange={onFieldChange}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium">向量维度</label>
                        <NumberInput
                            description="向量维度"
                            error={getFieldError(errors, "ai.embedding.dimension")}
                            min={1}
                            path="ai.embedding.dimension"
                            value={(getNestedValue(config, "ai.embedding.dimension") as number) || 0}
                            onChange={onFieldChange}
                        />
                    </div>
                </div>
            </div>

            <div>
                <h4 className="text-md font-semibold mb-4">RPC 服务配置</h4>
                <div className="grid gap-4">
                    <div className="space-y-1">
                        <label className="text-sm font-medium">RPC 服务端口</label>
                        <NumberInput
                            description="RPC 服务端口"
                            error={getFieldError(errors, "ai.rpc.port")}
                            max={65535}
                            min={1}
                            path="ai.rpc.port"
                            value={(getNestedValue(config, "ai.rpc.port") as number) || 0}
                            onChange={onFieldChange}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AISection;
