/**
 * 任务节点属性表单
 *
 * 编辑任务类型、参数、重试次数、超时时间等
 */

import type { TaskHandlerType, WorkflowNodeData } from "../../types/index";

import React from "react";
import { Input, Select, SelectItem, Switch } from "@heroui/react";

interface TaskPropertyFormProps {
    data: WorkflowNodeData;
    onChange: (updates: Partial<WorkflowNodeData>) => void;
}

/**
 * 任务类型选项
 */
const TASK_TYPES: { value: TaskHandlerType; label: string }[] = [
    { value: "ProvideData", label: "数据提供 (ProvideData)" },
    { value: "Preprocess", label: "数据预处理 (Preprocess)" },
    { value: "AISummarize", label: "AI 摘要 (AISummarize)" },
    { value: "GenerateEmbedding", label: "生成向量 (GenerateEmbedding)" },
    { value: "InterestScore", label: "兴趣度评分 (InterestScore)" },
    { value: "LLMInterestEvaluationAndNotification", label: "兴趣度评估与通知 (LLM)" }
];

/**
 * 任务属性表单组件
 */
export const TaskPropertyForm: React.FC<TaskPropertyFormProps> = ({ data, onChange }) => {
    return (
        <div className="flex flex-col gap-3">
            <Input label="节点名称" size="sm" value={data.label} onChange={e => onChange({ label: e.target.value })} />

            <Select
                label="任务类型"
                selectedKeys={data.taskType ? [data.taskType] : []}
                size="sm"
                onSelectionChange={keys => {
                    const selected = Array.from(keys)[0] as TaskHandlerType;

                    onChange({ taskType: selected });
                }}
            >
                {TASK_TYPES.map(type => (
                    <SelectItem key={type.value}>{type.label}</SelectItem>
                ))}
            </Select>

            <Input label="重试次数" size="sm" type="number" value={String(data.retryCount || 0)} onChange={e => onChange({ retryCount: parseInt(e.target.value) || 0 })} />

            <Input
                description="0 表示无超时限制"
                label="超时时间 (毫秒)"
                size="sm"
                type="number"
                value={String(data.timeoutMs || 0)}
                onChange={e => onChange({ timeoutMs: parseInt(e.target.value) || 0 })}
            />

            <Switch isSelected={data.skipOnFailure || false} size="sm" onValueChange={checked => onChange({ skipOnFailure: checked })}>
                失败后跳过（不终止流程）
            </Switch>
        </div>
    );
};
