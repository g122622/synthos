/**
 * 基于 JSON Schema 的 Record（动态键值对）编辑组件
 *
 * 典型场景：
 * - ai.models（key 为模型名）
 * - groupConfigs（key 为群号）
 */
import type { JsonSchema } from "@/api/configApi";
import type { FieldChangeHandler, SearchContext } from "../../types/index";

import React, { useMemo, useState, useCallback } from "react";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { Trash2, Plus, ChevronDown, ChevronUp } from "lucide-react";

import { highlightText, collectAllExpandablePaths, containsSearchQuery } from "../../utils/index";

export interface SchemaRecordEditorProps {
    path: string;
    value: Record<string, unknown>;
    itemSchema: JsonSchema;
    onFieldChange: FieldChangeHandler;
    renderItem: (itemPath: string, itemSchema: JsonSchema, itemValue: unknown) => React.ReactNode;
    /** 搜索上下文 */
    searchContext?: SearchContext;
}

/**
 * Record 类型配置项的编辑组件
 * 支持动态添加、删除键值对
 */
const SchemaRecordEditor: React.FC<SchemaRecordEditorProps> = ({ path, value, itemSchema, onFieldChange, renderItem, searchContext }) => {
    const [newKey, setNewKey] = useState<string>("");
    const searchQuery = searchContext?.query || "";

    const items = useMemo(() => {
        if (value && typeof value === "object" && !Array.isArray(value)) {
            return value;
        }

        return {};
    }, [value]);

    // 过滤匹配搜索条件的项
    const filteredEntries = useMemo(() => {
        const entries = Object.entries(items);

        if (!searchQuery.trim()) {
            return entries;
        }

        return entries.filter(([key]) => {
            // 检查 key 是否匹配
            if (containsSearchQuery(key, searchQuery)) {
                return true;
            }

            // 检查路径是否匹配
            const itemPath = `${path}.${key}`;

            if (containsSearchQuery(itemPath, searchQuery)) {
                return true;
            }

            // TODO: 可以进一步检查子字段是否匹配
            return false;
        });
    }, [items, path, searchQuery]);

    // 计算所有可展开的路径
    const allExpandablePaths = useMemo(() => {
        const paths: string[] = [];

        for (const [key, itemValue] of filteredEntries) {
            const itemPath = `${path}.${key}`;

            paths.push(itemPath);

            const childPaths = collectAllExpandablePaths(itemSchema, itemPath, itemValue);

            paths.push(...childPaths);
        }

        return paths;
    }, [filteredEntries, itemSchema, path]);

    // 计算当前展开的 key
    const selectedKeys = useMemo(() => {
        if (!searchContext) {
            return undefined;
        }

        const keys = new Set<string>();

        for (const [key] of filteredEntries) {
            const itemPath = `${path}.${key}`;

            if (searchContext.expandedKeys.has(itemPath)) {
                keys.add(key);
            }
        }

        return keys;
    }, [filteredEntries, path, searchContext]);

    /**
     * 展开所有子项
     */
    const handleExpandAll = useCallback(() => {
        if (!searchContext) {
            return;
        }

        const newKeys = new Set(searchContext.expandedKeys);

        for (const p of allExpandablePaths) {
            newKeys.add(p);
        }

        searchContext.onExpandedKeysChange(newKeys);
    }, [allExpandablePaths, searchContext]);

    /**
     * 折叠所有子项
     */
    const handleCollapseAll = useCallback(() => {
        if (!searchContext) {
            return;
        }

        const newKeys = new Set(searchContext.expandedKeys);

        for (const p of allExpandablePaths) {
            newKeys.delete(p);
        }

        searchContext.onExpandedKeysChange(newKeys);
    }, [allExpandablePaths, searchContext]);

    const addItem = (): void => {
        const trimmed = newKey.trim();

        if (!trimmed) {
            return;
        }

        if (items[trimmed] !== undefined) {
            return;
        }

        // 按你的要求：新增 record 项时生成空对象，让校验报错提示用户补全。
        onFieldChange(path, { ...items, [trimmed]: {} });
        setNewKey("");
    };

    const removeItem = (key: string): void => {
        const newItems = { ...items };

        delete newItems[key];

        onFieldChange(path, newItems);
    };

    if (filteredEntries.length === 0 && searchQuery) {
        return null;
    }

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <Input
                    placeholder="添加新项"
                    size="sm"
                    value={newKey}
                    onChange={e => setNewKey(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === "Enter") {
                            addItem();
                        }
                    }}
                />
                <Button isDisabled={!newKey.trim() || items[newKey.trim()] !== undefined} size="sm" onPress={addItem}>
                    <Plus className="w-4 h-4 mr-1" />
                    添加
                </Button>
            </div>

            {/* 局部展开/折叠按钮 */}
            {searchContext && allExpandablePaths.length > 0 && (
                <div className="flex justify-end gap-2">
                    <Button size="sm" startContent={<ChevronDown className="w-3 h-3" />} variant="light" onPress={handleExpandAll}>
                        展开全部
                    </Button>
                    <Button size="sm" startContent={<ChevronUp className="w-3 h-3" />} variant="light" onPress={handleCollapseAll}>
                        折叠全部
                    </Button>
                </div>
            )}

            <Accordion
                selectedKeys={selectedKeys}
                selectionMode="multiple"
                variant="bordered"
                onSelectionChange={keys => {
                    if (!searchContext) {
                        return;
                    }

                    const newExpandedKeys = new Set(searchContext.expandedKeys);

                    // 先移除当前 Accordion 下的所有 key
                    for (const [key] of filteredEntries) {
                        const itemPath = `${path}.${key}`;

                        newExpandedKeys.delete(itemPath);
                    }

                    // 添加新选中的 key
                    if (keys !== "all") {
                        for (const key of keys) {
                            const itemPath = `${path}.${key}`;

                            newExpandedKeys.add(itemPath);
                        }
                    }

                    searchContext.onExpandedKeysChange(newExpandedKeys);
                }}
            >
                {filteredEntries.map(([key, itemValue]) => {
                    const itemPath = `${path}.${key}`;

                    // 高亮 key
                    const highlightedKey = searchQuery ? highlightText(key, searchQuery) : key;

                    return (
                        <AccordionItem
                            key={key}
                            startContent={
                                <Chip size="sm" variant="flat">
                                    📦
                                </Chip>
                            }
                            title={
                                <div className="flex items-center justify-between w-full pr-4">
                                    <span className="font-medium">{highlightedKey}</span>
                                </div>
                            }
                        >
                            <div className="space-y-4 p-2">
                                {renderItem(itemPath, itemSchema, itemValue)}

                                <Button color="danger" size="sm" variant="flat" onPress={() => removeItem(key)}>
                                    <Trash2 className="w-4 h-4 mr-1" />
                                    删除
                                </Button>
                            </div>
                        </AccordionItem>
                    );
                })}
            </Accordion>
        </div>
    );
};

export default SchemaRecordEditor;
