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

/** 搜索上下文，用于传递搜索状态给子组件 */
export interface SearchContext {
    /** 搜索关键词 */
    query: string;
    /** 当前展开的路径集合 */
    expandedKeys: Set<string>;
    /** 设置展开路径的回调 */
    onExpandedKeysChange: (keys: Set<string>) => void;
}

/** 字符串输入组件 Props */
export interface StringInputProps {
    label: string;
    /** 可选的 React 节点形式的标签，用于显示高亮文本 */
    labelNode?: React.ReactNode;
    path: string;
    value: string;
    description?: string;
    onChange: (path: string, value: string) => void;
    error?: string;
}

/** 数字输入组件 Props */
export interface NumberInputProps {
    label: string;
    /** 可选的 React 节点形式的标签，用于显示高亮文本 */
    labelNode?: React.ReactNode;
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
    label: string;
    /** 可选的 React 节点形式的标签，用于显示高亮文本 */
    labelNode?: React.ReactNode;
    path: string;
    value: boolean;
    description?: string;
    onChange: (path: string, value: boolean) => void;
}

/** 枚举选择组件 Props */
export interface EnumSelectProps {
    label: string;
    /** 可选的 React 节点形式的标签，用于显示高亮文本 */
    labelNode?: React.ReactNode;
    path: string;
    value: string;
    options: string[];
    description?: string;
    onChange: (path: string, value: string) => void;
    error?: string;
}

/** 字符串数组编辑组件 Props */
export interface StringArrayEditorProps {
    label: string;
    /** 可选的 React 节点形式的标签，用于显示高亮文本 */
    labelNode?: React.ReactNode;
    path: string;
    value: string[];
    description?: string;
    onChange: (path: string, value: string[]) => void;
}

/** 元组数组编辑组件 Props */
export interface TupleArrayEditorProps {
    label: string;
    /** 可选的 React 节点形式的标签，用于显示高亮文本 */
    labelNode?: React.ReactNode;
    path: string;
    /** 元组数组值，每个元组包含两个字符串数组 */
    value: [string[], string[]][];
    description?: string;
    /** 第一个数组项的标签 */
    firstItemLabel?: string;
    /** 第二个数组项的标签 */
    secondItemLabel?: string;
    onChange: (path: string, value: [string[], string[]][]) => void;
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
    /** 搜索关键词 */
    searchQuery: string;
    /** 搜索关键词变更回调 */
    onSearchQueryChange: (query: string) => void;
}
