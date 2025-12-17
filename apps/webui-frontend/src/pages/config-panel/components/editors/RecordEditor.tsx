/**
 * Record（动态键值对）编辑组件
 */
import type { RecordEditorProps, ValidationError } from "../../types";

import React, { useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Chip } from "@heroui/chip";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { Trash2, Plus } from "lucide-react";

import { StringInput, NumberInput, EnumSelect, StringArrayEditor } from "../inputs";

/**
 * 获取字段错误信息
 */
const getFieldErrorFromList = (errors: ValidationError[], fieldPath: string): string | undefined => {
    const error = errors.find(e => e.path === fieldPath);

    return error?.message;
};

const RecordEditor: React.FC<RecordEditorProps> = ({ path, value, itemSchema, onChange, onFieldChange, errors }) => {
    const [newKey, setNewKey] = useState("");
    const items = value && typeof value === "object" ? value : {};

    const addItem = () => {
        if (newKey.trim() && !items[newKey.trim()]) {
            const defaultValue =
                itemSchema === "ModelConfig" ? { apiKey: "", baseURL: "", temperature: 0.7, maxTokens: 4096 } : { IM: "QQ", splitStrategy: "realtime", groupIntroduction: "", aiModels: [] };

            onChange(path, { ...items, [newKey.trim()]: defaultValue });
            setNewKey("");
        }
    };

    const removeItem = (key: string) => {
        const newItems = { ...items };

        delete newItems[key];
        onChange(path, newItems);
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <Input
                    placeholder={`添加新${itemSchema === "ModelConfig" ? "模型" : "群组"}`}
                    size="sm"
                    value={newKey}
                    onChange={e => setNewKey(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addItem()}
                />
                <Button isDisabled={!newKey.trim() || !!items[newKey.trim()]} size="sm" onPress={addItem}>
                    <Plus className="w-4 h-4 mr-1" />
                    添加
                </Button>
            </div>

            <Accordion selectionMode="multiple" variant="bordered">
                {Object.entries(items).map(([key, itemValue]) => {
                    const itemPath = `${path}.${key}`;
                    const itemData = itemValue as Record<string, unknown>;

                    return (
                        <AccordionItem
                            key={key}
                            startContent={
                                <Chip size="sm" variant="flat">
                                    {itemSchema === "ModelConfig" ? "模型" : "群组"}
                                </Chip>
                            }
                            title={
                                <div className="flex items-center justify-between w-full pr-4">
                                    <span className="font-medium">{key}</span>
                                </div>
                            }
                        >
                            <div className="space-y-4 p-2">
                                {itemSchema === "ModelConfig" ? (
                                    <>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium">API 密钥</label>
                                            <StringInput
                                                description="API 密钥"
                                                error={getFieldErrorFromList(errors, `${itemPath}.apiKey`)}
                                                path={`${itemPath}.apiKey`}
                                                value={(itemData.apiKey as string) || ""}
                                                onChange={onFieldChange}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium">API 基础 URL</label>
                                            <StringInput
                                                description="API 基础 URL"
                                                error={getFieldErrorFromList(errors, `${itemPath}.baseURL`)}
                                                path={`${itemPath}.baseURL`}
                                                value={(itemData.baseURL as string) || ""}
                                                onChange={onFieldChange}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium">温度参数</label>
                                            <NumberInput
                                                description="温度参数，控制输出的随机性"
                                                error={getFieldErrorFromList(errors, `${itemPath}.temperature`)}
                                                max={2}
                                                min={0}
                                                path={`${itemPath}.temperature`}
                                                value={(itemData.temperature as number) || 0}
                                                onChange={onFieldChange}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium">最大 Token 数量</label>
                                            <NumberInput
                                                description="最大 Token 数量"
                                                error={getFieldErrorFromList(errors, `${itemPath}.maxTokens`)}
                                                min={1}
                                                path={`${itemPath}.maxTokens`}
                                                value={(itemData.maxTokens as number) || 0}
                                                onChange={onFieldChange}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium">IM 平台</label>
                                            <EnumSelect
                                                description="IM 平台类型"
                                                error={getFieldErrorFromList(errors, `${itemPath}.IM`)}
                                                options={["QQ", "WeChat"]}
                                                path={`${itemPath}.IM`}
                                                value={(itemData.IM as string) || "QQ"}
                                                onChange={onFieldChange}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium">消息分割策略</label>
                                            <EnumSelect
                                                description="消息分割策略"
                                                error={getFieldErrorFromList(errors, `${itemPath}.splitStrategy`)}
                                                options={["realtime", "accumulative"]}
                                                path={`${itemPath}.splitStrategy`}
                                                value={(itemData.splitStrategy as string) || "realtime"}
                                                onChange={onFieldChange}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium">群简介</label>
                                            <StringInput
                                                description="群简介，用于拼接在 context 里面"
                                                error={getFieldErrorFromList(errors, `${itemPath}.groupIntroduction`)}
                                                path={`${itemPath}.groupIntroduction`}
                                                value={(itemData.groupIntroduction as string) || ""}
                                                onChange={onFieldChange}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium">AI 模型列表</label>
                                            <StringArrayEditor
                                                description="要使用的 AI 模型名列表，按优先级排序"
                                                path={`${itemPath}.aiModels`}
                                                value={(itemData.aiModels as string[]) || []}
                                                onChange={onFieldChange}
                                            />
                                        </div>
                                    </>
                                )}
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

export default RecordEditor;
