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
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/table";
import { Plus, Trash2 } from "lucide-react";

/**
 * 内联字符串数组编辑器
 */
const InlineStringArrayEditor: React.FC<{
    value: string[];
    onChange: (value: string[]) => void;
    placeholder?: string;
}> = ({ value, onChange, placeholder }) => {
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
        <div className="min-w-[150px] max-w-sm">
            <div className="flex flex-wrap gap-1 mb-1">
                {items.map((item, index) => (
                    <Chip key={index} className="h-6 text-xs max-w-full" size="sm" variant="flat" onClose={() => removeItem(index)}>
                        <span className="truncate">{item}</span>
                    </Chip>
                ))}
            </div>
            <div className="flex gap-1">
                <Input
                    classNames={{ input: "text-xs", inputWrapper: "h-7 min-h-7" }}
                    placeholder={placeholder}
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
                <Button isIconOnly className="h-7 min-w-7 w-7" isDisabled={!newItem.trim()} size="sm" variant="flat" onPress={addItem}>
                    <Plus className="w-3 h-3" />
                </Button>
            </div>
        </div>
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
        <div className="space-y-2 max-w-5xl">
            <div className="flex justify-between items-end">
                <div>
                    <label className="text-sm font-medium block">{labelNode || label}</label>
                    {description && <p className="text-xs text-default-500 mt-0.5">{description}</p>}
                </div>
                <Button className="h-7" size="sm" startContent={<Plus className="w-3 h-3" />} variant="flat" onPress={addItem}>
                    添加条目
                </Button>
            </div>

            <Table
                isCompact
                aria-label={label || "Tuple Array Editor"}
                classNames={{ wrapper: "p-0 shadow-none border border-default-200 rounded-lg overflow-x-auto", th: "h-8 min-h-8 text-xs bg-default-100", td: "py-2" }}
                layout="fixed"
            >
                <TableHeader>
                    <TableColumn className="w-10 text-center">#</TableColumn>
                    <TableColumn>{firstItemLabel}</TableColumn>
                    <TableColumn>{secondItemLabel}</TableColumn>
                    <TableColumn className="w-10 text-center">操作</TableColumn>
                </TableHeader>
                <TableBody emptyContent="点击上方“添加条目”按钮开始添加">
                    {items.map((item, index) => (
                        <TableRow key={index}>
                            <TableCell className="text-xs text-default-400 text-center align-top pt-3">{index + 1}</TableCell>
                            <TableCell className="align-top">
                                <InlineStringArrayEditor placeholder={`添加${firstItemLabel}`} value={item[0]} onChange={newValue => updateFirst(index, newValue)} />
                            </TableCell>
                            <TableCell className="align-top">
                                <InlineStringArrayEditor placeholder={`添加${secondItemLabel}`} value={item[1]} onChange={newValue => updateSecond(index, newValue)} />
                            </TableCell>
                            <TableCell className="align-top pt-2">
                                <div className="flex justify-center">
                                    <Button isIconOnly className="h-7 w-7 min-w-7" color="danger" size="sm" variant="light" onPress={() => removeItem(index)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};

export default TupleArrayEditor;
