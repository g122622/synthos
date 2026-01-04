/**
 * 配置面板工具函数
 */

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
