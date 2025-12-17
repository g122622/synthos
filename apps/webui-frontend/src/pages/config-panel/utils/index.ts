/**
 * 配置面板工具函数
 */

import { SENSITIVE_FIELDS } from "../constants";

/**
 * 判断字段是否为敏感字段
 */
export const isSensitiveField = (path: string): boolean => {
    return SENSITIVE_FIELDS.some(pattern => {
        const regexPattern = pattern.replace(/\*/g, "[^.]+");

        return new RegExp(`^${regexPattern}$`).test(path);
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
