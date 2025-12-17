/**
 * 配置面板类型定义
 */

/** 校验错误 */
export interface ValidationError {
    path: string;
    message: string;
}

/** 配置区域定义 */
export interface SectionConfig {
    key: string;
    label: string;
    icon: string;
}

/** 字段变更处理函数类型 */
export type FieldChangeHandler = (path: string, value: unknown) => void;

/** 字符串输入组件 Props */
export interface StringInputProps {
    path: string;
    value: string;
    description?: string;
    onChange: (path: string, value: string) => void;
    error?: string;
}

/** 数字输入组件 Props */
export interface NumberInputProps {
    path: string;
    value: number;
    description?: string;
    min?: number;
    max?: number;
    onChange: (path: string, value: number) => void;
    error?: string;
}

/** 布尔开关组件 Props */
export interface BooleanSwitchProps {
    path: string;
    value: boolean;
    description?: string;
    onChange: (path: string, value: boolean) => void;
}

/** 枚举选择组件 Props */
export interface EnumSelectProps {
    path: string;
    value: string;
    options: string[];
    description?: string;
    onChange: (path: string, value: string) => void;
    error?: string;
}

/** 字符串数组编辑组件 Props */
export interface StringArrayEditorProps {
    path: string;
    value: string[];
    description?: string;
    onChange: (path: string, value: string[]) => void;
}

/** Record 编辑器 Props */
export interface RecordEditorProps {
    path: string;
    value: Record<string, unknown>;
    itemSchema: "ModelConfig" | "GroupConfig";
    onChange: (path: string, value: Record<string, unknown>) => void;
    onFieldChange: FieldChangeHandler;
    errors: ValidationError[];
}

/** Section 组件通用 Props */
export interface SectionProps {
    config: Record<string, unknown>;
    errors: ValidationError[];
    onFieldChange: FieldChangeHandler;
}

/** 侧边栏组件 Props */
export interface ConfigSidebarProps {
    sections: SectionConfig[];
    activeSection: string;
    onSectionClick: (sectionKey: string) => void;
}
