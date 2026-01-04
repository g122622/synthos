/**
 * 配置面板工具函数
 */

import type { JsonSchema } from "@/api/configApi";

import React from "react";

import { SENSITIVE_FIELDS } from "../constants/index";

/**
 * 判断路径是否匹配带通配符的 pattern。
 * 规则：以 "." 分段，pattern 中的 "*" 匹配任意单段；必须完全匹配。
 */
const isPathMatchPattern = (path: string, pattern: string): boolean => {
    const pathSegments = path.split(".");
    const patternSegments = pattern.split(".");

    if (pathSegments.length !== patternSegments.length) {
        return false;
    }

    for (let i = 0; i < patternSegments.length; i++) {
        const patternSegment = patternSegments[i];
        const pathSegment = pathSegments[i];

        if (patternSegment === "*") {
            continue;
        }

        if (patternSegment !== pathSegment) {
            return false;
        }
    }

    return true;
};

/**
 * 判断字段是否为敏感字段
 */
export const isSensitiveField = (path: string): boolean => {
    return SENSITIVE_FIELDS.some(pattern => {
        return isPathMatchPattern(path, pattern);
    });
};

/**
 * 深度获取对象值
 */
export const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
    return path.split(".").reduce((acc: unknown, key) => {
        if (acc && typeof acc === "object") {
            return (acc as Record<string, unknown>)[key];
        }

        return undefined;
    }, obj);
};

/**
 * 深度设置对象值
 */
export const setNestedValue = (obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> => {
    const keys = path.split(".");
    const result = { ...obj };
    let current: Record<string, unknown> = result;

    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];

        if (!(key in current) || typeof current[key] !== "object" || current[key] === null) {
            current[key] = {};
        } else {
            current[key] = { ...(current[key] as Record<string, unknown>) };
        }
        current = current[key] as Record<string, unknown>;
    }

    current[keys[keys.length - 1]] = value;

    return result;
};

/**
 * 检查文本是否包含搜索关键词（不区分大小写）
 */
export const containsSearchQuery = (text: string, query: string): boolean => {
    if (!query.trim()) {
        return true;
    }

    return text.toLowerCase().includes(query.toLowerCase());
};

/**
 * 高亮文本中匹配搜索关键词的部分
 * 返回 React 节点数组，匹配部分用 mark 标签包裹
 */
export const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query.trim()) {
        return text;
    }

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let currentIndex = lowerText.indexOf(lowerQuery);
    let keyCounter = 0;

    while (currentIndex !== -1) {
        // 添加匹配前的文本
        if (currentIndex > lastIndex) {
            parts.push(text.slice(lastIndex, currentIndex));
        }

        // 添加高亮的匹配文本
        parts.push(
            React.createElement(
                "mark",
                {
                    key: `highlight-${keyCounter}`,
                    className: "bg-warning-200 text-warning-800 rounded px-0.5"
                },
                text.slice(currentIndex, currentIndex + query.length)
            )
        );

        keyCounter++;
        lastIndex = currentIndex + query.length;
        currentIndex = lowerText.indexOf(lowerQuery, lastIndex);
    }

    // 添加剩余的文本
    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : text;
};

/**
 * 检查配置字段是否匹配搜索条件
 * 搜索范围包括：label、description、配置路径/key
 */
export const isFieldMatchingSearch = (query: string, label: string, description: string | undefined, path: string): boolean => {
    if (!query.trim()) {
        return true;
    }

    const lowerQuery = query.toLowerCase();

    // 检查 label
    if (label.toLowerCase().includes(lowerQuery)) {
        return true;
    }

    // 检查 description
    if (description && description.toLowerCase().includes(lowerQuery)) {
        return true;
    }

    // 检查路径
    if (path.toLowerCase().includes(lowerQuery)) {
        return true;
    }

    return false;
};

/**
 * 从 schema.description 或 schema.title 中提取 label
 */
const extractLabelFromSchema = (schema: JsonSchema, fallbackLabel: string): string => {
    if (schema.title) {
        return schema.title;
    }

    if (schema.description) {
        const description = schema.description.trim();
        const candidates = ["，", "。", "\n"];
        let firstIndex = -1;

        for (const c of candidates) {
            const idx = description.indexOf(c);

            if (idx > 0) {
                if (firstIndex === -1 || idx < firstIndex) {
                    firstIndex = idx;
                }
            }
        }

        if (firstIndex > 0 && firstIndex <= 20) {
            return description.slice(0, firstIndex).trim();
        }

        return description;
    }

    return fallbackLabel;
};

/**
 * 递归检查 schema 中是否有任何字段匹配搜索条件
 * 用于判断整个 section 是否应该显示
 */
export const doesSchemaHaveMatchingFields = (schema: JsonSchema, basePath: string, value: unknown, query: string): boolean => {
    if (!query.trim()) {
        return true;
    }

    const label = extractLabelFromSchema(schema, basePath.split(".").slice(-1)[0]);
    const description = schema.description;

    // 检查当前字段是否匹配
    if (isFieldMatchingSearch(query, label, description, basePath)) {
        return true;
    }

    // 如果是对象类型，递归检查子字段
    if (schema.type === "object" || schema.properties || schema.additionalProperties) {
        // 检查 additionalProperties（Record 类型）
        if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
            if (value && typeof value === "object" && !Array.isArray(value)) {
                const recordValue = value as Record<string, unknown>;

                for (const [key, itemValue] of Object.entries(recordValue)) {
                    const itemPath = `${basePath}.${key}`;

                    // 检查 key 是否匹配
                    if (key.toLowerCase().includes(query.toLowerCase())) {
                        return true;
                    }

                    if (doesSchemaHaveMatchingFields(schema.additionalProperties, itemPath, itemValue, query)) {
                        return true;
                    }
                }
            }
        }

        // 检查 properties
        if (schema.properties) {
            const objValue = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

            for (const [key, propSchema] of Object.entries(schema.properties)) {
                const propPath = `${basePath}.${key}`;

                if (doesSchemaHaveMatchingFields(propSchema, propPath, objValue[key], query)) {
                    return true;
                }
            }
        }
    }

    // 检查数组类型
    if (schema.type === "array" && schema.items) {
        // 对于数组，只检查数组本身的 label 和 description 是否匹配
        // 不需要检查每个元素
    }

    return false;
};

/**
 * 递归收集 schema 中所有可展开的路径
 * 用于"全部展开"功能
 */
export const collectAllExpandablePaths = (schema: JsonSchema, basePath: string, value: unknown): string[] => {
    const paths: string[] = [];

    // 如果当前 schema 是对象类型，且有 properties
    if (schema.type === "object" || schema.properties || schema.additionalProperties) {
        // 如果有 additionalProperties（Record 类型），收集所有已有的 key
        if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
            if (value && typeof value === "object" && !Array.isArray(value)) {
                const recordValue = value as Record<string, unknown>;

                for (const key of Object.keys(recordValue)) {
                    const itemPath = `${basePath}.${key}`;

                    paths.push(itemPath);

                    // 递归收集子路径
                    const childPaths = collectAllExpandablePaths(schema.additionalProperties, itemPath, recordValue[key]);

                    paths.push(...childPaths);
                }
            }
        }

        // 如果有 properties，遍历每个属性
        if (schema.properties) {
            const objValue = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

            for (const [key, propSchema] of Object.entries(schema.properties)) {
                const propType = propSchema.type;
                const hasNestedProperties = propSchema.properties || propSchema.additionalProperties;

                // 只有嵌套的 object 类型才是可展开的
                if (propType === "object" || hasNestedProperties) {
                    const propPath = `${basePath}.${key}`;

                    paths.push(propPath);

                    // 递归收集子路径
                    const childPaths = collectAllExpandablePaths(propSchema, propPath, objValue[key]);

                    paths.push(...childPaths);
                }
            }
        }
    }

    return paths;
};

/**
 * 获取路径的所有父路径
 * 例如：'ai.models.gpt4' -> ['ai', 'ai.models', 'ai.models.gpt4']
 */
export const getParentPaths = (path: string): string[] => {
    const segments = path.split(".");
    const paths: string[] = [];
    let current = "";

    for (const segment of segments) {
        current = current ? `${current}.${segment}` : segment;
        paths.push(current);
    }

    return paths;
};
