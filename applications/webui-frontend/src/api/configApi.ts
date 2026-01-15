/**
 * 配置面板 API 接口
 * 用于与后端配置管理服务通信
 */
import API_BASE_URL from "./constants/baseUrl";

import fetchWrapper from "@/util/fetchWrapper";

// ==================== 类型定义 ====================

/**
 * JSON Schema 类型（简化版）
 */
export interface JsonSchema {
    $ref?: string;
    $schema?: string;

    /**
     * zod-to-json-schema 默认会把根 schema 放在 definitions 里，并用 $ref 指向它。
     */
    definitions?: Record<string, JsonSchema>;

    type?: string;
    title?: string;
    description?: string;
    format?: string;

    properties?: Record<string, JsonSchema>;
    required?: string[];

    /** 数组项的 schema，可以是单个 schema 或 schema 数组（用于 tuple） */
    items?: JsonSchema | JsonSchema[];
    /** 数组最小长度（用于 tuple 类型） */
    minItems?: number;
    /** 数组最大长度（用于 tuple 类型） */
    maxItems?: number;
    enum?: string[];

    minimum?: number;
    maximum?: number;
    default?: unknown;

    additionalProperties?: boolean | JsonSchema;

    anyOf?: JsonSchema[];
    oneOf?: JsonSchema[];
}

/**
 * 配置验证结果
 */
export interface ConfigValidationResult {
    valid: boolean;
    errors?: Array<{ path: string; message: string }> | string[];
}

// ==================== API 接口 ====================

/**
 * 获取配置的 JSON Schema
 */
export const getConfigSchema = async (): Promise<ApiResponse<JsonSchema>> => {
    const response = await fetchWrapper(`${API_BASE_URL}/api/config/schema`);

    return response.json();
};

/**
 * 获取当前合并后的配置
 */
export const getCurrentConfig = async (): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await fetchWrapper(`${API_BASE_URL}/api/config/current`);

    return response.json();
};

/**
 * 获取基础配置
 */
export const getBaseConfig = async (): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await fetchWrapper(`${API_BASE_URL}/api/config/base`);

    return response.json();
};

/**
 * 获取 override 配置
 */
export const getOverrideConfig = async (): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await fetchWrapper(`${API_BASE_URL}/api/config/override`);

    return response.json();
};

/**
 * 保存 override 配置
 */
export const saveOverrideConfig = async (config: Record<string, unknown>): Promise<ApiResponse<{ message: string }>> => {
    const response = await fetchWrapper(`${API_BASE_URL}/api/config/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
    });

    return response.json();
};

/**
 * 验证配置
 */
export const validateConfig = async (config: Record<string, unknown>, partial: boolean): Promise<ApiResponse<ConfigValidationResult>> => {
    const response = await fetchWrapper(`${API_BASE_URL}/api/config/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, partial })
    });

    return response.json();
};
