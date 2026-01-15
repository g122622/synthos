/**
 * 基于 JSON Schema 的动态表单渲染器
 *
 * 设计目标：
 * 1. 完全由后端返回的 schema 驱动，无需在前端手写字段布局。
 * 2. 复用现有输入组件：StringInput / NumberInput / BooleanSwitch / EnumSelect / StringArrayEditor。
 * 3. 对于 record（additionalProperties）结构，支持动态新增/删除 key。
 * 4. 支持搜索过滤、高亮匹配文本。
 * 5. 支持全局和局部的展开/折叠控制。
 */
import type { JsonSchema } from "@/api/configApi";
import type { FieldChangeHandler, SearchContext, ValidationError } from "../../types/index";

import React, { useMemo, useCallback } from "react";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { Button } from "@heroui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

import { BooleanSwitch, EnumSelect, NumberInput, StringArrayEditor, StringInput, TupleArrayEditor } from "../inputs/index";
import { highlightText, isFieldMatchingSearch, collectAllExpandablePaths } from "../../utils/index";

import SchemaRecordEditor from "./SchemaRecordEditor";

export interface SchemaFormProps {
    /** 当前 schema 对应的配置路径（例如：ai.defaultModelConfig） */
    path: string;

    /** 当前路径对应的 value（用于递归渲染时减少 deep-get） */
    rootValue: unknown;

    schema: JsonSchema;
    errors: ValidationError[];
    onFieldChange: FieldChangeHandler;

    /** 搜索上下文，用于过滤和高亮 */
    searchContext?: SearchContext;
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
 * 检查字段或其子字段是否匹配搜索条件
 * 用于决定是否显示该字段
 */
const doesFieldOrChildrenMatch = (
    schema: JsonSchema,
    path: string,
    value: unknown,
    query: string,
    getLabelAndDescFn: (s: JsonSchema, fallback: string) => { label: string; description?: string }
): boolean => {
    if (!query.trim()) {
        return true;
    }

    const fieldKey = path.split(".").slice(-1)[0];
    const { label, description } = getLabelAndDescFn(schema, fieldKey);

    // 检查当前字段是否匹配
    if (isFieldMatchingSearch(query, label, description, path)) {
        return true;
    }

    // 如果是对象类型，递归检查子字段
    const schemaType = getSchemaRenderType(schema);

    if (schemaType === "object") {
        // 检查 additionalProperties（Record 类型）
        if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
            if (value && typeof value === "object" && !Array.isArray(value)) {
                const recordValue = value as Record<string, unknown>;

                for (const [key, itemValue] of Object.entries(recordValue)) {
                    const itemPath = `${path}.${key}`;

                    if (doesFieldOrChildrenMatch(schema.additionalProperties, itemPath, itemValue, query, getLabelAndDescFn)) {
                        return true;
                    }
                }
            }
        }

        // 检查 properties
        if (schema.properties) {
            const objValue = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

            for (const [key, propSchema] of Object.entries(schema.properties)) {
                const propPath = `${path}.${key}`;

                if (doesFieldOrChildrenMatch(propSchema, propPath, objValue[key], query, getLabelAndDescFn)) {
                    return true;
                }
            }
        }
    }

    return false;
};

/**
 * 递归渲染 schema。
 */
const SchemaForm: React.FC<SchemaFormProps> = ({ path, rootValue, schema, errors, onFieldChange, searchContext }) => {
    const schemaType = getSchemaRenderType(schema);
    const searchQuery = searchContext?.query || "";

    const normalizedObjectValue = useMemo(() => {
        if (rootValue && typeof rootValue === "object" && !Array.isArray(rootValue)) {
            return rootValue as Record<string, unknown>;
        }

        return {} as Record<string, unknown>;
    }, [rootValue]);

    /**
     * 展开当前 Accordion 下的所有子项
     */
    const handleExpandAll = useCallback(
        (nestedPaths: string[]) => {
            if (!searchContext) {
                return;
            }

            const newKeys = new Set(searchContext.expandedKeys);

            for (const p of nestedPaths) {
                newKeys.add(p);
            }

            searchContext.onExpandedKeysChange(newKeys);
        },
        [searchContext]
    );

    /**
     * 折叠当前 Accordion 下的所有子项
     */
    const handleCollapseAll = useCallback(
        (nestedPaths: string[]) => {
            if (!searchContext) {
                return;
            }

            const newKeys = new Set(searchContext.expandedKeys);

            for (const p of nestedPaths) {
                newKeys.delete(p);
            }

            searchContext.onExpandedKeysChange(newKeys);
        },
        [searchContext]
    );

    // ============ object（常规对象）===========

    if (schemaType === "object" && schema.additionalProperties && typeof schema.additionalProperties === "object") {
        const recordValue = normalizedObjectValue;
        const itemSchema = schema.additionalProperties;

        return (
            <SchemaRecordEditor
                itemSchema={itemSchema}
                path={path}
                renderItem={(itemPath, itemSchemaFromRecord, itemValue) => {
                    return <SchemaForm errors={errors} path={itemPath} rootValue={itemValue} schema={itemSchemaFromRecord} searchContext={searchContext} onFieldChange={onFieldChange} />;
                }}
                searchContext={searchContext}
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

        // 过滤匹配搜索条件的字段
        const filteredPrimitiveFields = primitiveFields.filter(field => {
            const fieldPath = `${path}.${field.key}`;

            return doesFieldOrChildrenMatch(field.schema, fieldPath, field.value, searchQuery, getLabelAndDescription);
        });

        const filteredNestedFields = nestedFields.filter(field => {
            const fieldPath = `${path}.${field.key}`;

            return doesFieldOrChildrenMatch(field.schema, fieldPath, field.value, searchQuery, getLabelAndDescription);
        });

        // 计算当前 Accordion 下所有可展开的路径
        const allNestedPaths: string[] = [];

        for (const field of filteredNestedFields) {
            const fieldPath = `${path}.${field.key}`;

            allNestedPaths.push(fieldPath);

            // 递归收集子路径
            const childPaths = collectAllExpandablePaths(field.schema, fieldPath, field.value);

            allNestedPaths.push(...childPaths);
        }

        // 计算当前展开的 key
        let selectedKeys: Set<string> | undefined = undefined;

        if (searchContext) {
            selectedKeys = new Set<string>();

            for (const field of filteredNestedFields) {
                const fieldPath = `${path}.${field.key}`;

                if (searchContext.expandedKeys.has(fieldPath)) {
                    selectedKeys.add(field.key);
                }
            }
        }

        // 判断是否有匹配的字段
        const hasMatchingFields = filteredPrimitiveFields.length > 0 || filteredNestedFields.length > 0;

        if (!hasMatchingFields && searchQuery) {
            return null;
        }

        return (
            <div className="space-y-3">
                <div className="space-y-2">
                    {filteredPrimitiveFields.map(field => {
                        return (
                            <SchemaForm
                                key={field.key}
                                errors={errors}
                                path={`${path}.${field.key}`}
                                rootValue={field.value}
                                schema={field.schema}
                                searchContext={searchContext}
                                onFieldChange={onFieldChange}
                            />
                        );
                    })}
                </div>

                {filteredNestedFields.length > 0 && (
                    <div className="space-y-2">
                        {/* 局部展开/折叠按钮 */}
                        {searchContext && allNestedPaths.length > 0 && (
                            <div className="flex justify-end gap-2">
                                <Button className="h-6 min-h-6 text-xs" size="sm" startContent={<ChevronDown className="w-3 h-3" />} variant="light" onPress={() => handleExpandAll(allNestedPaths)}>
                                    展开全部
                                </Button>
                                <Button className="h-6 min-h-6 text-xs" size="sm" startContent={<ChevronUp className="w-3 h-3" />} variant="light" onPress={() => handleCollapseAll(allNestedPaths)}>
                                    折叠全部
                                </Button>
                            </div>
                        )}

                        <Accordion
                            isCompact
                            itemClasses={{
                                title: "text-sm",
                                subtitle: "text-xs",
                                content: "py-2"
                            }}
                            selectedKeys={selectedKeys}
                            selectionMode="multiple"
                            variant="bordered"
                            onSelectionChange={keys => {
                                if (!searchContext) {
                                    return;
                                }

                                const newExpandedKeys = new Set(searchContext.expandedKeys);

                                // 先移除当前 Accordion 下的所有 key
                                for (const field of filteredNestedFields) {
                                    const fieldPath = `${path}.${field.key}`;

                                    newExpandedKeys.delete(fieldPath);
                                }

                                // 添加新选中的 key
                                if (keys !== "all") {
                                    for (const key of keys) {
                                        const fieldPath = `${path}.${key}`;

                                        newExpandedKeys.add(fieldPath);
                                    }
                                }

                                searchContext.onExpandedKeysChange(newExpandedKeys);
                            }}
                        >
                            {filteredNestedFields.map(field => {
                                const fieldPath = `${path}.${field.key}`;
                                const { label, description } = getLabelAndDescription(field.schema, field.key);

                                // 高亮标题和描述
                                const highlightedLabel = searchQuery ? highlightText(label, searchQuery) : label;
                                const highlightedDescription = searchQuery && description ? highlightText(description, searchQuery) : description;

                                return (
                                    <AccordionItem key={field.key} className="pt-2 pl-1" subtitle={highlightedDescription} title={highlightedLabel}>
                                        <div className="p-2 pt-0">
                                            <SchemaForm errors={errors} path={fieldPath} rootValue={field.value} schema={field.schema} searchContext={searchContext} onFieldChange={onFieldChange} />
                                        </div>
                                    </AccordionItem>
                                );
                            })}
                        </Accordion>
                    </div>
                )}
            </div>
        );
    }

    // ============ array ============

    if (schemaType === "array") {
        const itemsSchema = schema.items;

        // 检查是否为 tuple 数组类型：array of tuple([string[], string[]])
        // zod-to-json-schema 会将 tuple 转换为 items 数组 + minItems/maxItems 的结构
        // 例如：{ type: "array", items: { type: "array", minItems: 2, maxItems: 2, items: [...] } }
        if (
            itemsSchema &&
            !Array.isArray(itemsSchema) &&
            itemsSchema.type === "array" &&
            itemsSchema.minItems === 2 &&
            itemsSchema.maxItems === 2 &&
            Array.isArray(itemsSchema.items) &&
            itemsSchema.items.length === 2
        ) {
            const tupleItems = itemsSchema.items;
            const firstItemSchema = tupleItems[0];
            const secondItemSchema = tupleItems[1];

            // 检查每个 tuple 元素是否为 string[]
            if (
                firstItemSchema.type === "array" &&
                firstItemSchema.items &&
                !Array.isArray(firstItemSchema.items) &&
                getSchemaRenderType(firstItemSchema.items) === "string" &&
                secondItemSchema.type === "array" &&
                secondItemSchema.items &&
                !Array.isArray(secondItemSchema.items) &&
                getSchemaRenderType(secondItemSchema.items) === "string"
            ) {
                const fieldValue = Array.isArray(rootValue) ? (rootValue as [string[], string[]][]) : [];
                const { label, description } = getLabelAndDescription(schema, path.split(".").slice(-1)[0]);

                // 从每个 tuple 元素的 description 获取标签
                const firstLabel = firstItemSchema.description || "第一项";
                const secondLabel = secondItemSchema.description || "第二项";

                // 检查是否匹配搜索条件
                if (searchQuery && !isFieldMatchingSearch(searchQuery, label, description, path)) {
                    return null;
                }

                // 高亮标题和描述
                const highlightedLabel = searchQuery ? highlightText(label, searchQuery) : label;
                const highlightedDescription = searchQuery && description ? highlightText(description, searchQuery) : description;

                return (
                    <TupleArrayEditor
                        description={typeof highlightedDescription === "string" ? highlightedDescription : undefined}
                        firstItemLabel={firstLabel}
                        label={typeof highlightedLabel === "string" ? highlightedLabel : label}
                        labelNode={typeof highlightedLabel !== "string" ? highlightedLabel : undefined}
                        path={path}
                        secondItemLabel={secondLabel}
                        value={fieldValue}
                        onChange={onFieldChange}
                    />
                );
            }
        }

        // 目前配置项中主要使用 string[]，其余类型后续有需要再扩展。
        // 注意：itemsSchema 可能是数组（tuple 类型），这里只处理非数组的情况
        if (itemsSchema && !Array.isArray(itemsSchema) && getSchemaRenderType(itemsSchema) === "string") {
            const fieldValue = Array.isArray(rootValue) ? (rootValue as string[]) : [];
            const { label, description } = getLabelAndDescription(schema, path.split(".").slice(-1)[0]);

            // 检查是否匹配搜索条件
            if (searchQuery && !isFieldMatchingSearch(searchQuery, label, description, path)) {
                return null;
            }

            // 高亮标题和描述
            const highlightedLabel = searchQuery ? highlightText(label, searchQuery) : label;
            const highlightedDescription = searchQuery && description ? highlightText(description, searchQuery) : description;

            return (
                <StringArrayEditor
                    description={typeof highlightedDescription === "string" ? highlightedDescription : undefined}
                    label={typeof highlightedLabel === "string" ? highlightedLabel : label}
                    labelNode={typeof highlightedLabel !== "string" ? highlightedLabel : undefined}
                    path={path}
                    value={fieldValue}
                    onChange={onFieldChange}
                />
            );
        }

        return <div className="text-sm text-default-500">当前数组类型暂不支持渲染：{path}</div>;
    }

    // ============ enum ============

    if (schema.enum && schema.enum.length > 0) {
        const fieldValue = typeof rootValue === "string" ? rootValue : "";
        const { label, description } = getLabelAndDescription(schema, path.split(".").slice(-1)[0]);

        // 检查是否匹配搜索条件
        if (searchQuery && !isFieldMatchingSearch(searchQuery, label, description, path)) {
            return null;
        }

        // 高亮标题和描述
        const highlightedLabel = searchQuery ? highlightText(label, searchQuery) : label;
        const highlightedDescription = searchQuery && description ? highlightText(description, searchQuery) : description;

        return (
            <EnumSelect
                description={typeof highlightedDescription === "string" ? highlightedDescription : undefined}
                error={getFieldError(errors, path)}
                label={typeof highlightedLabel === "string" ? highlightedLabel : label}
                labelNode={typeof highlightedLabel !== "string" ? highlightedLabel : undefined}
                options={schema.enum}
                path={path}
                value={fieldValue}
                onChange={onFieldChange}
            />
        );
    }

    // ============ primitive ============

    const fieldKey = path.split(".").slice(-1)[0];
    const { label, description } = getLabelAndDescription(schema, fieldKey);

    // 检查是否匹配搜索条件
    if (searchQuery && !isFieldMatchingSearch(searchQuery, label, description, path)) {
        return null;
    }

    // 高亮标题和描述
    const highlightedLabel = searchQuery ? highlightText(label, searchQuery) : label;
    const highlightedDescription = searchQuery && description ? highlightText(description, searchQuery) : description;

    if (schemaType === "string") {
        const fieldValue = typeof rootValue === "string" ? rootValue : "";

        return (
            <StringInput
                description={typeof highlightedDescription === "string" ? highlightedDescription : undefined}
                error={getFieldError(errors, path)}
                label={typeof highlightedLabel === "string" ? highlightedLabel : label}
                labelNode={typeof highlightedLabel !== "string" ? highlightedLabel : undefined}
                path={path}
                value={fieldValue}
                onChange={onFieldChange}
            />
        );
    }

    if (schemaType === "boolean") {
        const fieldValue = typeof rootValue === "boolean" ? rootValue : false;

        return (
            <BooleanSwitch
                description={typeof highlightedDescription === "string" ? highlightedDescription : undefined}
                label={typeof highlightedLabel === "string" ? highlightedLabel : label}
                labelNode={typeof highlightedLabel !== "string" ? highlightedLabel : undefined}
                path={path}
                value={fieldValue}
                onChange={onFieldChange}
            />
        );
    }

    if (schemaType === "number" || schemaType === "integer") {
        const fieldValue = typeof rootValue === "number" ? rootValue : 0;

        return (
            <NumberInput
                description={typeof highlightedDescription === "string" ? highlightedDescription : undefined}
                error={getFieldError(errors, path)}
                label={typeof highlightedLabel === "string" ? highlightedLabel : label}
                labelNode={typeof highlightedLabel !== "string" ? highlightedLabel : undefined}
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
