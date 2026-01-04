/**
 * 基于 JSON Schema 的 Record（动态键值对）编辑组件
 *
 * 典型场景：
 * - ai.models（key 为模型名）
 * - groupConfigs（key 为群号）
 */
import type { JsonSchema } from "@/api/configApi";
import type { FieldChangeHandler } from "../../types/index";

import React, { useMemo, useState } from "react";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { Trash2, Plus } from "lucide-react";

export interface SchemaRecordEditorProps {
    path: string;
    value: Record<string, unknown>;
    itemSchema: JsonSchema;
    onFieldChange: FieldChangeHandler;
    renderItem: (itemPath: string, itemSchema: JsonSchema, itemValue: unknown) => React.ReactNode;
}

const SchemaRecordEditor: React.FC<SchemaRecordEditorProps> = ({ path, value, itemSchema, onFieldChange, renderItem }) => {
    const [newKey, setNewKey] = useState<string>("");

    const items = useMemo(() => {
        if (value && typeof value === "object" && !Array.isArray(value)) {
            return value;
        }

        return {};
    }, [value]);

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

            <Accordion selectionMode="multiple" variant="bordered">
                {Object.entries(items).map(([key, itemValue]) => {
                    const itemPath = `${path}.${key}`;

                    return (
                        <AccordionItem
                            key={key}
                            startContent={
                                <Chip size="sm" variant="flat">
                                    项
                                </Chip>
                            }
                            title={
                                <div className="flex items-center justify-between w-full pr-4">
                                    <span className="font-medium">{key}</span>
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
