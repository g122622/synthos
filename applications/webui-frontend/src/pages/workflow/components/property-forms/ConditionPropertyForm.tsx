/**
 * 条件节点属性表单
 *
 * 编辑条件类型和表达式
 */

import React from "react";
import { Input, Select, SelectItem } from "@heroui/react";
import type { ConditionType, WorkflowNodeData } from "../../types/index";

interface ConditionPropertyFormProps {
    data: WorkflowNodeData;
    onChange: (updates: Partial<WorkflowNodeData>) => void;
}

/**
 * 条件类型选项
 */
const CONDITION_TYPES: { value: ConditionType; label: string }[] = [
    { value: "previousNodeSuccess", label: "上游节点成功" },
    { value: "previousNodeFailed", label: "上游节点失败" },
    { value: "keyValueMatch", label: "键值匹配" }
];

/**
 * 条件属性表单组件
 */
export const ConditionPropertyForm: React.FC<ConditionPropertyFormProps> = ({ data, onChange }) => {
    return (
        <div className="flex flex-col gap-3">
            <Input label="节点名称" size="sm" value={data.label} onChange={e => onChange({ label: e.target.value })} />

            <Select
                label="条件类型"
                size="sm"
                selectedKeys={data.conditionType ? [data.conditionType] : []}
                onSelectionChange={keys => {
                    const selected = Array.from(keys)[0] as ConditionType;
                    onChange({ conditionType: selected });
                }}
            >
                {CONDITION_TYPES.map(type => (
                    <SelectItem key={type.value}>{type.label}</SelectItem>
                ))}
            </Select>

            {data.conditionType === "keyValueMatch" && (
                <div className="flex flex-col gap-2">
                    <p className="text-xs text-default-500">键值匹配表达式 (JSON)</p>
                    <textarea
                        className="w-full p-2 text-xs font-mono bg-default-100 border border-default-200 rounded-md"
                        rows={6}
                        value={JSON.stringify(data.conditionExpression || {}, null, 2)}
                        onChange={e => {
                            try {
                                const parsed = JSON.parse(e.target.value);
                                onChange({ conditionExpression: parsed });
                            } catch {
                                // 输入未完成，暂不更新
                            }
                        }}
                    />
                </div>
            )}
        </div>
    );
};
