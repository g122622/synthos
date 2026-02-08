/**
 * 任务注册表相关类型定义
 *
 * 注意：此文件定义前端使用的任务注册表类型
 * 与后端 common/scheduler/registry/types.ts 保持结构一致
 */

/**
 * 表单字段类型
 */
export type FormFieldType = "string" | "number" | "boolean" | "array" | "timestamp" | "select";

/**
 * 表单字段配置
 */
export interface FormFieldConfig {
    /** 字段名称 */
    name: string;
    /** 字段类型 */
    type: FormFieldType;
    /** 显示标签 */
    label: string;
    /** 描述文本 */
    description?: string;
    /** 是否必填 */
    required?: boolean;
    /** 数组项类型（仅当 type="array" 时有效） */
    itemType?: "string" | "number";
    /** 选项列表（仅当 type="select" 时有效） */
    options?: Array<{ value: string; label: string }>;
    /** 默认值 */
    defaultValue?: any;
}

/**
 * UI 配置
 */
export interface UIConfig {
    /** 参数表单字段配置 */
    formFields?: FormFieldConfig[];
    /** 图标 */
    icon?: string;
    /** 分类 */
    category?: string;
}

/**
 * 任务元数据（前端可序列化版本）
 */
export interface TaskMetadata {
    /** 任务名称 */
    name: string;
    /** 任务显示名称 */
    displayName: string;
    /** 任务描述 */
    description?: string;
    /** 参数 JSON Schema */
    paramsJsonSchema: any;
    /** UI 配置 */
    uiConfig?: UIConfig;
}

/**
 * 任务注册表响应
 */
export interface TaskRegistryResponse {
    tasks: TaskMetadata[];
}
