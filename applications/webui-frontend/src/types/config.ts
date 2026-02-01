/**
 * 配置相关的类型定义
 */

/**
 * JSON Schema类型（简化版）
 */
export interface JsonSchema {
    $ref?: string;
    $schema?: string;

    /**
     * zod-to-json-schema默认会把根schema放在definitions里，并用$ref指向它
     */
    definitions?: Record<string, JsonSchema>;

    type?: string;
    title?: string;
    description?: string;
    format?: string;

    properties?: Record<string, JsonSchema>;
    required?: string[];

    /** 数组项的schema，可以是单个schema或schema数组（用于tuple） */
    items?: JsonSchema | JsonSchema[];
    /** 数组最小长度（用于tuple类型） */
    minItems?: number;
    /** 数组最大长度（用于tuple类型） */
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
