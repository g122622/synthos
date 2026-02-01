/**
 * 配置面板 API 接口
 * 用于与后端配置管理服务通信
 */
import type { JsonSchema, ConfigValidationResult } from "@/types/config";
import type { ApiResponse } from "@/types/api";

import API_BASE_URL from "./constants/baseUrl";

import fetchWrapper from "@/util/fetchWrapper";
import { mockConfig } from "@/config/mock";
import { mockGetConfigSchema, mockGetCurrentConfig, mockGetBaseConfig, mockGetOverrideConfig, mockSaveOverrideConfig, mockSaveBaseConfig, mockValidateConfig } from "@/mock/configMock";

// 导出类型供其他模块使用
export type { JsonSchema, ConfigValidationResult };

// ==================== API 接口 ====================

/**
 * 获取配置的 JSON Schema
 */
export const getConfigSchema = async (): Promise<ApiResponse<JsonSchema>> => {
    if (mockConfig.configPanel) {
        return mockGetConfigSchema();
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/config/schema`);

    return response.json();
};

/**
 * 获取当前合并后的配置
 */
export const getCurrentConfig = async (): Promise<ApiResponse<Record<string, unknown>>> => {
    if (mockConfig.configPanel) {
        return mockGetCurrentConfig();
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/config/current`);

    return response.json();
};

/**
 * 获取基础配置
 */
export const getBaseConfig = async (): Promise<ApiResponse<Record<string, unknown>>> => {
    if (mockConfig.configPanel) {
        return mockGetBaseConfig();
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/config/base`);

    return response.json();
};

/**
 * 获取 override 配置
 */
export const getOverrideConfig = async (): Promise<ApiResponse<Record<string, unknown>>> => {
    if (mockConfig.configPanel) {
        return mockGetOverrideConfig();
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/config/override`);

    return response.json();
};

/**
 * 保存 override 配置
 */
export const saveOverrideConfig = async (config: Record<string, unknown>): Promise<ApiResponse<{ message: string }>> => {
    if (mockConfig.configPanel) {
        return mockSaveOverrideConfig(config);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/config/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
    });

    return response.json();
};

/**
 * 保存基础配置
 */
export const saveBaseConfig = async (config: Record<string, unknown>): Promise<ApiResponse<{ message: string }>> => {
    if (mockConfig.configPanel) {
        return mockSaveBaseConfig(config);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/config/base`, {
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
    if (mockConfig.configPanel) {
        return mockValidateConfig(config, partial);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/config/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, partial })
    });

    return response.json();
};
