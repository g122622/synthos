/**
 * 动态参数表单组件
 *
 * 根据任务元数据的 formFields 动态渲染表单字段
 */

import type { FormFieldConfig } from "../../types/taskRegistry";

import React from "react";
import { Input, Select, SelectItem, Textarea, Chip } from "@heroui/react";
import { X, Plus } from "lucide-react";

interface DynamicParamsFormProps {
    formFields: FormFieldConfig[];
    values: Record<string, any>;
    onChange: (name: string, value: any) => void;
}

/**
 * 动态参数表单组件
 */
export const DynamicParamsForm: React.FC<DynamicParamsFormProps> = ({ formFields, values, onChange }) => {
    const [arrayInputs, setArrayInputs] = React.useState<Record<string, string>>({});

    return (
        <div className="flex flex-col gap-3">
            {formFields.map(field => (
                <div key={field.name}>
                    {renderField(
                        field,
                        values[field.name],
                        value => onChange(field.name, value),
                        arrayInputs[field.name] || "",
                        input => setArrayInputs({ ...arrayInputs, [field.name]: input })
                    )}
                </div>
            ))}
        </div>
    );
};

/**
 * 根据字段配置渲染对应的表单控件
 */
function renderField(
    field: FormFieldConfig,
    value: any,
    onChange: (value: any) => void,
    arrayInput: string,
    setArrayInput: (input: string) => void
): React.ReactNode {
    switch (field.type) {
        case "string":
            return (
                <Input
                    label={field.label}
                    description={field.description}
                    size="sm"
                    value={value || ""}
                    isRequired={field.required}
                    onChange={e => onChange(e.target.value)}
                />
            );

        case "number":
            return (
                <Input
                    label={field.label}
                    description={field.description}
                    type="number"
                    size="sm"
                    value={value?.toString() || ""}
                    isRequired={field.required}
                    onChange={e => onChange(Number(e.target.value))}
                />
            );

        case "boolean":
            return (
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={value || false}
                        onChange={e => onChange(e.target.checked)}
                    />
                    <label className="text-sm">
                        {field.label}
                        {field.description && <span className="text-gray-500 ml-2">({field.description})</span>}
                    </label>
                </div>
            );

        case "array":
            return renderArrayField(field, value, onChange, arrayInput, setArrayInput);

        case "timestamp":
            return renderTimestampField(field, value, onChange);

        case "select":
            return (
                <Select
                    label={field.label}
                    description={field.description}
                    size="sm"
                    selectedKeys={value ? [value] : []}
                    isRequired={field.required}
                    onSelectionChange={keys => {
                        const selected = Array.from(keys)[0];

                        onChange(selected);
                    }}
                >
                    {(field.options || []).map(opt => (
                        <SelectItem key={opt.value}>
                            {opt.label}
                        </SelectItem>
                    ))}
                </Select>
            );

        default:
            return (
                <Textarea
                    label={field.label}
                    description={field.description || "JSON 格式"}
                    size="sm"
                    value={JSON.stringify(value || {}, null, 2)}
                    onChange={e => {
                        try {
                            onChange(JSON.parse(e.target.value));
                        } catch {
                            // 忽略解析错误
                        }
                    }}
                />
            );
    }
}

/**
 * 渲染数组字段（支持添加/删除项）
 */
function renderArrayField(
    field: FormFieldConfig,
    value: any,
    onChange: (value: any) => void,
    arrayInput: string,
    setArrayInput: (input: string) => void
): React.ReactNode {
    const items = Array.isArray(value) ? value : [];

    const handleAdd = () => {
        if (!arrayInput.trim()) {
            return;
        }

        const newItem = field.itemType === "number" ? Number(arrayInput) : arrayInput.trim();

        onChange([...items, newItem]);
        setArrayInput("");
    };

    const handleRemove = (index: number) => {
        onChange(items.filter((_, i) => i !== index));
    };

    return (
        <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.description && <p className="text-xs text-gray-500">{field.description}</p>}

            {/* 当前项列表 */}
            {items.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {items.map((item, index) => (
                        <Chip
                            key={index}
                            size="sm"
                            variant="flat"
                            onClose={() => handleRemove(index)}
                            endContent={<X className="w-3 h-3 cursor-pointer" />}
                        >
                            {item}
                        </Chip>
                    ))}
                </div>
            )}

            {/* 添加新项 */}
            <div className="flex gap-2">
                <Input
                    size="sm"
                    type={field.itemType === "number" ? "number" : "text"}
                    placeholder={`输入${field.label}`}
                    value={arrayInput}
                    onChange={e => setArrayInput(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === "Enter") {
                            handleAdd();
                        }
                    }}
                />
                <button
                    type="button"
                    className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm flex items-center gap-1 hover:bg-blue-600"
                    onClick={handleAdd}
                >
                    <Plus className="w-4 h-4" />
                    添加
                </button>
            </div>
        </div>
    );
}

/**
 * 渲染时间戳字段（支持日期时间选择器）
 */
function renderTimestampField(
    field: FormFieldConfig,
    value: any,
    onChange: (value: any) => void
): React.ReactNode {
    // 将毫秒时间戳转换为 datetime-local 格式
    const dateValue = value
        ? new Date(value).toISOString().slice(0, 16)
        : "";

    return (
        <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.description && <p className="text-xs text-gray-500 mb-1">{field.description}</p>}
            <input
                type="datetime-local"
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                value={dateValue}
                onChange={e => {
                    const timestamp = new Date(e.target.value).getTime();

                    onChange(timestamp);
                }}
            />
        </div>
    );
}
