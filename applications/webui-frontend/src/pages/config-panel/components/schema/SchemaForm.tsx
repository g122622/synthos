/**
 * 基于 JSON Schema 的动态表单渲染器
 *
 * 设计目标：
 * 1. 完全由后端返回的 schema 驱动，无需在前端手写字段布局。
 * 2. 复用现有输入组件：StringInput / NumberInput / BooleanSwitch / EnumSelect / StringArrayEditor。
 * 3. 对于 record（additionalProperties）结构，支持动态新增/删除 key。
 */
import type { JsonSchema } from "@/api/configApi";
import type { FieldChangeHandler, ValidationError } from "../../types/index";

import React, { useMemo } from "react";
import { Accordion, AccordionItem } from "@heroui/accordion";

import { BooleanSwitch, EnumSelect, NumberInput, StringArrayEditor, StringInput } from "../inputs/index";

import SchemaRecordEditor from "./SchemaRecordEditor";

export interface SchemaFormProps {
    /** 当前 schema 对应的配置路径（例如：ai.defaultModelConfig） */
    path: string;

    /** 当前路径对应的 value（用于递归渲染时减少 deep-get） */
    rootValue: unknown;

    schema: JsonSchema;
    errors: ValidationError[];
    onFieldChange: FieldChangeHandler;
}

/**
 * 获取字段错误
 */
const getFieldError = (errors: ValidationError[], path: string): string | undefined => {
    const error = errors.find(e => e.path === path);

    return error?.message;
};

type RenderType = "string" | "number" | "integer" | "boolean" | "object" | "array" | "unknown";

/**
 * 解析 schema 类型。
 * 注意：zod-to-json-schema 在部分场景下可能不显式填写 type（例如只给 enum）。
 */
const getSchemaRenderType = (schema: JsonSchema): RenderType => {
    if (schema.type) {
        if (schema.type === "string") {
            return "string";
        }
        if (schema.type === "number") {
            return "number";
        }
        if (schema.type === "integer") {
            return "integer";
        }
        if (schema.type === "boolean") {
            return "boolean";
        }
        if (schema.type === "object") {
            return "object";
        }
        if (schema.type === "array") {
            return "array";
        }
    }

    if (schema.enum && schema.enum.length > 0) {
        return "string";
    }

    if (schema.properties || schema.additionalProperties) {
        return "object";
    }

    if (schema.items) {
        return "array";
    }

    return "unknown";
};

/**
 * 将 schema.description 分割成更适合 UI 的 label + description。
 *
 * 规则：
 * - 若 description 中包含中文逗号/句号/换行，且分割点在前 20 个字符内，则取分割前作为 label。
 * - 否则 label 直接使用 description。
 */
const getLabelAndDescription = (schema: JsonSchema, fallbackLabel: string): { label: string; description?: string } => {
    const description = schema.description?.trim();
    const title = schema.title?.trim();

    if (title) {
        return { label: title, description };
    }

    if (!description) {
        return { label: fallbackLabel };
    }

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
        const label = description.slice(0, firstIndex).trim();
        const rest = description.slice(firstIndex + 1).trim();

        if (rest) {
            return { label, description: rest };
        }

        return { label };
    }

    return { label: description };
};

/**
 * 递归渲染 schema。
 */
const SchemaForm: React.FC<SchemaFormProps> = ({ path, rootValue, schema, errors, onFieldChange }) => {
    const schemaType = getSchemaRenderType(schema);

    const normalizedObjectValue = useMemo(() => {
        if (rootValue && typeof rootValue === "object" && !Array.isArray(rootValue)) {
            return rootValue as Record<string, unknown>;
        }

        return {} as Record<string, unknown>;
    }, [rootValue]);

    // ============ object（常规对象）===========

    if (schemaType === "object" && schema.additionalProperties && typeof schema.additionalProperties === "object") {
        const recordValue = normalizedObjectValue;
        const itemSchema = schema.additionalProperties;

        return (
            <SchemaRecordEditor
                itemSchema={itemSchema}
                path={path}
                renderItem={(itemPath, itemSchemaFromRecord, itemValue) => {
                    return <SchemaForm errors={errors} path={itemPath} rootValue={itemValue} schema={itemSchemaFromRecord} onFieldChange={onFieldChange} />;
                }}
                value={recordValue}
                onFieldChange={onFieldChange}
            />
        );
    }

    if (schemaType === "object") {
        const properties = schema.properties || {};

        // 为了避免层级太深导致页面过长：
        // - primitive 字段直接渲染
        // - object/record 字段使用 Accordion 折叠
        const primitiveFields: Array<{ key: string; schema: JsonSchema; value: unknown }> = [];
        const nestedFields: Array<{ key: string; schema: JsonSchema; value: unknown }> = [];

        for (const [key, propertySchema] of Object.entries(properties)) {
            const childValue = normalizedObjectValue[key];
            const childType = getSchemaRenderType(propertySchema);

            if (childType === "object") {
                nestedFields.push({ key, schema: propertySchema, value: childValue });
            } else {
                primitiveFields.push({ key, schema: propertySchema, value: childValue });
            }
        }

        return (
            <div className="space-y-6">
                <div className="space-y-4">
                    {primitiveFields.map(field => {
                        return <SchemaForm key={field.key} errors={errors} path={`${path}.${field.key}`} rootValue={field.value} schema={field.schema} onFieldChange={onFieldChange} />;
                    })}
                </div>

                {nestedFields.length > 0 && (
                    <Accordion selectionMode="multiple" variant="bordered">
                        {nestedFields.map(field => {
                            const fieldPath = `${path}.${field.key}`;
                            const { label, description } = getLabelAndDescription(field.schema, field.key);

                            return (
                                <AccordionItem key={field.key} subtitle={description} title={label}>
                                    <div className="p-2">
                                        <SchemaForm errors={errors} path={fieldPath} rootValue={field.value} schema={field.schema} onFieldChange={onFieldChange} />
                                    </div>
                                </AccordionItem>
                            );
                        })}
                    </Accordion>
                )}
            </div>
        );
    }

    // ============ array ============

    if (schemaType === "array") {
        const itemsSchema = schema.items;

        // 目前配置项中主要使用 string[]，其余类型后续有需要再扩展。
        if (itemsSchema && getSchemaRenderType(itemsSchema) === "string") {
            const fieldValue = Array.isArray(rootValue) ? (rootValue as string[]) : [];
            const { label, description } = getLabelAndDescription(schema, path.split(".").slice(-1)[0]);

            return <StringArrayEditor description={description} label={label} path={path} value={fieldValue} onChange={onFieldChange} />;
        }

        return <div className="text-sm text-default-500">当前数组类型暂不支持渲染：{path}</div>;
    }

    // ============ enum ============

    if (schema.enum && schema.enum.length > 0) {
        const fieldValue = typeof rootValue === "string" ? rootValue : "";
        const { label, description } = getLabelAndDescription(schema, path.split(".").slice(-1)[0]);

        return <EnumSelect description={description} error={getFieldError(errors, path)} label={label} options={schema.enum} path={path} value={fieldValue} onChange={onFieldChange} />;
    }

    // ============ primitive ============

    const fieldKey = path.split(".").slice(-1)[0];
    const { label, description } = getLabelAndDescription(schema, fieldKey);

    if (schemaType === "string") {
        const fieldValue = typeof rootValue === "string" ? rootValue : "";

        return <StringInput description={description} error={getFieldError(errors, path)} label={label} path={path} value={fieldValue} onChange={onFieldChange} />;
    }

    if (schemaType === "boolean") {
        const fieldValue = typeof rootValue === "boolean" ? rootValue : false;

        return <BooleanSwitch description={description} label={label} path={path} value={fieldValue} onChange={onFieldChange} />;
    }

    if (schemaType === "number" || schemaType === "integer") {
        const fieldValue = typeof rootValue === "number" ? rootValue : 0;

        return (
            <NumberInput
                description={description}
                error={getFieldError(errors, path)}
                label={label}
                max={schema.maximum}
                min={schema.minimum}
                path={path}
                value={fieldValue}
                onChange={onFieldChange}
            />
        );
    }

    return <div className="text-sm text-default-500">当前字段类型暂不支持渲染：{path}</div>;
};

export default SchemaForm;
