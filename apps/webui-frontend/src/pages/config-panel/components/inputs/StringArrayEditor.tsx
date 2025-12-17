/**
 * 字符串数组编辑组件
 */
import type { StringArrayEditorProps } from "../../types";

import React, { useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Chip } from "@heroui/chip";
import { Plus } from "lucide-react";

const StringArrayEditor: React.FC<StringArrayEditorProps> = ({ path, value, description, onChange }) => {
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
        <div className="space-y-2">
            {description && <p className="text-sm text-default-500">{description}</p>}
            <div className="flex flex-wrap gap-2">
                {items.map((item, index) => (
                    <Chip key={index} variant="flat" onClose={() => removeItem(index)}>
                        {item}
                    </Chip>
                ))}
            </div>
            <div className="flex gap-2">
                <Input placeholder="添加新项" size="sm" value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === "Enter" && addItem()} />
                <Button isIconOnly isDisabled={!newItem.trim()} size="sm" onPress={addItem}>
                    <Plus className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};

export default StringArrayEditor;
