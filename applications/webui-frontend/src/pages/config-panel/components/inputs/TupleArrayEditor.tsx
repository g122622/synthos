/**
 * 元组数组编辑组件
 *
 * 用于编辑如 z.array(z.tuple([z.array(z.string()), z.array(z.string())])) 这样的结构
 * 典型用例：背景知识库 - 每条知识包含"关键词列表"和"解释列表"两个字符串数组
 */
import type { TupleArrayEditorProps } from "../../types/index";

import React, { useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Chip } from "@heroui/chip";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Plus, Trash2 } from "lucide-react";

/**
 * 单个元组项的编辑器
 */
interface TupleItemEditorProps {
    /** 元组索引 */
    index: number;
    /** 第一个数组的值 */
    firstArray: string[];
    /** 第二个数组的值 */
    secondArray: string[];
    /** 第一个数组的标签 */
    firstLabel: string;
    /** 第二个数组的标签 */
    secondLabel: string;
    /** 当第一个数组变化时的回调 */
    onFirstChange: (value: string[]) => void;
    /** 当第二个数组变化时的回调 */
    onSecondChange: (value: string[]) => void;
    /** 删除此元组项的回调 */
    onDelete: () => void;
}

/**
 * 内联字符串数组编辑器
 */
const InlineStringArrayEditor: React.FC<{
    label: string;
    value: string[];
    onChange: (value: string[]) => void;
}> = ({ label, value, onChange }) => {
    const [newItem, setNewItem] = useState("");
    const items = Array.isArray(value) ? value : [];

    const addItem = () => {
        if (newItem.trim()) {
            onChange([...items, newItem.trim()]);
            setNewItem("");
        }
    };

    const removeItem = (index: number) => {
        onChange(items.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-2">
            <label className="text-xs font-medium text-default-600">{label}</label>
            <div className="flex flex-wrap gap-1 min-h-[28px]">
                {items.map((item, index) => (
                    <Chip key={index} size="sm" variant="flat" onClose={() => removeItem(index)}>
                        {item}
                    </Chip>
                ))}
            </div>
            <div className="flex gap-2">
                <Input
                    placeholder={`添加${label}`}
                    size="sm"
                    value={newItem}
                    onChange={e => setNewItem(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            addItem();
                        }
                    }}
                />
                <Button isIconOnly isDisabled={!newItem.trim()} size="sm" variant="flat" onPress={addItem}>
                    <Plus className="w-3 h-3" />
                </Button>
            </div>
        </div>
    );
};

/**
 * 单个元组项的编辑器
 */
const TupleItemEditor: React.FC<TupleItemEditorProps> = ({ index, firstArray, secondArray, firstLabel, secondLabel, onFirstChange, onSecondChange, onDelete }) => {
    return (
        <Card className="shadow-sm">
            <CardHeader className="flex justify-between items-center py-2 px-4">
                <span className="text-sm font-medium">#{index + 1}</span>
                <Button isIconOnly color="danger" size="sm" variant="light" onPress={onDelete}>
                    <Trash2 className="w-4 h-4" />
                </Button>
            </CardHeader>
            <CardBody className="pt-0 pb-3 px-4 space-y-3">
                <InlineStringArrayEditor label={firstLabel} value={firstArray} onChange={onFirstChange} />
                <InlineStringArrayEditor label={secondLabel} value={secondArray} onChange={onSecondChange} />
            </CardBody>
        </Card>
    );
};

/**
 * 元组数组编辑组件
 *
 * 用于编辑形如 [[string[], string[]], ...] 的数据结构
 */
const TupleArrayEditor: React.FC<TupleArrayEditorProps> = ({ label, labelNode, path, value, description, firstItemLabel = "第一项", secondItemLabel = "第二项", onChange }) => {
    // 确保 value 是数组
    const items: [string[], string[]][] = Array.isArray(value)
        ? value.map(item => {
              if (Array.isArray(item) && item.length >= 2) {
                  return [Array.isArray(item[0]) ? item[0] : [], Array.isArray(item[1]) ? item[1] : []] as [string[], string[]];
              }

              return [[], []] as [string[], string[]];
          })
        : [];

    /**
     * 添加新的元组项
     */
    const addItem = () => {
        const newItems: [string[], string[]][] = [...items, [[], []]];

        onChange(path, newItems);
    };

    /**
     * 删除指定索引的元组项
     */
    const removeItem = (index: number) => {
        const newItems = items.filter((_, i) => i !== index);

        onChange(path, newItems);
    };

    /**
     * 更新指定索引元组项的第一个数组
     */
    const updateFirst = (index: number, newValue: string[]) => {
        const newItems = items.map((item, i) => {
            if (i === index) {
                return [newValue, item[1]] as [string[], string[]];
            }

            return item;
        });

        onChange(path, newItems);
    };

    /**
     * 更新指定索引元组项的第二个数组
     */
    const updateSecond = (index: number, newValue: string[]) => {
        const newItems = items.map((item, i) => {
            if (i === index) {
                return [item[0], newValue] as [string[], string[]];
            }

            return item;
        });

        onChange(path, newItems);
    };

    return (
        <div className="flex items-start">
            <label className="text-sm font-medium w-40 shrink-0 pt-2">{labelNode || label}</label>
            <div className="flex-1 space-y-3">
                {description && <p className="text-sm text-default-500">{description}</p>}

                <div className="space-y-3">
                    {items.map((item, index) => (
                        <TupleItemEditor
                            key={index}
                            firstArray={item[0]}
                            firstLabel={firstItemLabel}
                            index={index}
                            secondArray={item[1]}
                            secondLabel={secondItemLabel}
                            onDelete={() => removeItem(index)}
                            onFirstChange={newValue => updateFirst(index, newValue)}
                            onSecondChange={newValue => updateSecond(index, newValue)}
                        />
                    ))}
                </div>

                <Button className="w-full" size="sm" startContent={<Plus className="w-4 h-4" />} variant="flat" onPress={addItem}>
                    添加条目
                </Button>
            </div>
        </div>
    );
};

export default TupleArrayEditor;
