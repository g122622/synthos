/**
 * Config Panel 模块模拟数据
 * 用于在只启动前端时展示 UI 效果
 */

import type { ConfigValidationResult, JsonSchema } from "@/api/configApi";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let baseConfig: Record<string, unknown> = {
    report: {
        generation: {
            interestScoreThreshold: 0.2,
            maxTopics: 20
        }
    },
    rag: {
        topK: 5,
        enableQueryRewriter: true
    },
    system: {
        timezone: "Asia/Shanghai"
    }
};

let overrideConfig: Record<string, unknown> = {};

const buildMockSchema = (): JsonSchema => {
    return {
        type: "object",
        title: "Synthos 配置（Mock）",
        description: "用于前端 Mock 展示的简化 Schema，仅覆盖常见字段。",
        properties: {
            report: {
                type: "object",
                title: "日报",
                properties: {
                    generation: {
                        type: "object",
                        title: "生成",
                        properties: {
                            interestScoreThreshold: {
                                type: "number",
                                title: "兴趣阈值",
                                description: "兴趣得分阈值，范围 -1 ~ 1。",
                                minimum: -1,
                                maximum: 1,
                                default: 0.2
                            },
                            maxTopics: {
                                type: "number",
                                title: "最多话题数",
                                description: "每份日报最多包含的话题数量。",
                                minimum: 1,
                                maximum: 200,
                                default: 20
                            }
                        },
                        required: ["interestScoreThreshold", "maxTopics"]
                    }
                },
                required: ["generation"]
            },
            rag: {
                type: "object",
                title: "RAG",
                properties: {
                    topK: {
                        type: "number",
                        title: "TopK",
                        minimum: 1,
                        maximum: 50,
                        default: 5
                    },
                    enableQueryRewriter: {
                        type: "string",
                        title: "启用 Query Rewriter",
                        description: "Mock 下用字符串展示布尔值，避免 UI 类型推断问题。",
                        enum: ["true", "false"],
                        default: "true"
                    }
                },
                required: ["topK", "enableQueryRewriter"]
            },
            system: {
                type: "object",
                title: "系统",
                properties: {
                    timezone: {
                        type: "string",
                        title: "时区",
                        default: "Asia/Shanghai"
                    }
                },
                required: ["timezone"]
            }
        },
        required: ["report", "rag", "system"]
    };
};

const mergeConfig = (base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> => {
    // 简化实现：仅做一层 merge，足够支持面板 mock 展示
    return { ...base, ...override };
};

export const mockGetConfigSchema = async (): Promise<ApiResponse<JsonSchema>> => {
    await delay(200 + Math.random() * 150);

    return {
        success: true,
        data: buildMockSchema(),
        message: ""
    };
};

export const mockGetCurrentConfig = async (): Promise<ApiResponse<Record<string, unknown>>> => {
    await delay(220 + Math.random() * 180);

    return {
        success: true,
        data: mergeConfig(baseConfig, overrideConfig),
        message: ""
    };
};

export const mockGetBaseConfig = async (): Promise<ApiResponse<Record<string, unknown>>> => {
    await delay(180 + Math.random() * 120);

    return {
        success: true,
        data: baseConfig,
        message: ""
    };
};

export const mockGetOverrideConfig = async (): Promise<ApiResponse<Record<string, unknown>>> => {
    await delay(180 + Math.random() * 120);

    return {
        success: true,
        data: overrideConfig,
        message: ""
    };
};

export const mockSaveOverrideConfig = async (config: Record<string, unknown>): Promise<ApiResponse<{ message: string }>> => {
    await delay(250 + Math.random() * 150);

    overrideConfig = config;

    return {
        success: true,
        data: { message: "override 配置已保存（Mock）" },
        message: ""
    };
};

export const mockSaveBaseConfig = async (config: Record<string, unknown>): Promise<ApiResponse<{ message: string }>> => {
    await delay(250 + Math.random() * 150);

    baseConfig = config;

    return {
        success: true,
        data: { message: "基础配置已保存（Mock）" },
        message: ""
    };
};

export const mockValidateConfig = async (config: Record<string, unknown>, partial: boolean): Promise<ApiResponse<ConfigValidationResult>> => {
    await delay(200 + Math.random() * 150);

    void config;
    void partial;

    return {
        success: true,
        data: {
            valid: true,
            errors: []
        },
        message: ""
    };
};
