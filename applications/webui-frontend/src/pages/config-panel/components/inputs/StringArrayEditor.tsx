/**
 * 字符串数组编辑组件
 */
import type { StringArrayEditorProps } from "../../types/index";

import React, { useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Chip } from "@heroui/chip";
import { Plus } from "lucide-react";

/**
 * 字符串数组类型配置项的编辑组件
 * 支持添加、删除数组元素
 */
const StringArrayEditor: React.FC<StringArrayEditorProps> = ({ label, labelNode, path, value, description, onChange }) => {
    const [newItem, setNewItem] = useState("");
    const items = Array.isArray(value) ? value : [];

    const addItem = () => {
        if (newItem.trim()) {
            onChange(path, [...items, newItem.trim()]);
            setNewItem("");
        }
    };

    const removeItem = (index: number) => {
        onChange(
            path,
            items.filter((_, i) => i !== index)
        );
    };

    return (
        <div className="flex items-start">
            <label className="text-sm font-medium w-40 shrink-0 pt-1.5">{labelNode || label}</label>
            <div className="flex-1 space-y-2">
                {description && <p className="text-xs text-default-500">{description}</p>}
                <div className="flex flex-wrap gap-1">
                    {items.map((item, index) => (
                        <Chip key={index} className="h-6 text-xs" size="sm" variant="flat" onClose={() => removeItem(index)}>
                            {item}
                        </Chip>
                    ))}
                </div>
                <div className="flex gap-1">
                    <Input
                        classNames={{ input: "text-xs", inputWrapper: "h-7 min-h-7" }}
                        placeholder="添加新项"
                        size="sm"
                        value={newItem}
                        onChange={e => setNewItem(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && addItem()}
                    />
                    <Button isIconOnly className="h-7 w-7 min-w-7" isDisabled={!newItem.trim()} size="sm" onPress={addItem}>
                        <Plus className="w-3 h-3" />
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default StringArrayEditor;
