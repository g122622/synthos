/**
 * 任务节点属性表单
 *
 * 编辑任务类型、参数、重试次数、超时时间等
 */

import type { TaskHandlerType, WorkflowNodeData } from "../../types/index";
import type { TaskMetadata } from "../../types/taskRegistry";

import React from "react";
import { Input, Select, SelectItem, Switch, Spinner } from "@heroui/react";

import { DynamicParamsForm } from "./DynamicParamsForm";
import { fetchTaskRegistry } from "../../api/taskRegistryApi";

interface TaskPropertyFormProps {
    data: WorkflowNodeData;
    onChange: (updates: Partial<WorkflowNodeData>) => void;
}

/**
 * 任务属性表单组件
 */
export const TaskPropertyForm: React.FC<TaskPropertyFormProps> = ({ data, onChange }) => {
    const [taskRegistry, setTaskRegistry] = React.useState<TaskMetadata[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    // 加载任务注册表
    React.useEffect(() => {
        fetchTaskRegistry()
            .then(response => {
                setTaskRegistry(response.tasks);
                setLoading(false);
            })
            .catch(err => {
                console.error("加载任务注册表失败:", err);
                setError(err.message);
                setLoading(false);
            });
    }, []);

    // 获取当前任务的元数据
    const currentTaskMetadata = React.useMemo(() => {
        if (!data.taskType) {
            return null;
        }

        return taskRegistry.find(task => task.name === data.taskType);
    }, [data.taskType, taskRegistry]);

    // 处理参数变化
    const handleParamChange = (name: string, value: any) => {
        const currentParams = data.params || {};

        onChange({
            params: {
                ...currentParams,
                [name]: value
            }
        });
    };

    return (
        <div className="flex flex-col gap-3">
            <Input label="节点名称" size="sm" value={data.label} onChange={e => onChange({ label: e.target.value })} />

            {loading ? (
                <div className="flex items-center justify-center py-4">
                    <Spinner size="sm" />
                    <span className="ml-2 text-sm text-gray-500">加载任务列表...</span>
                </div>
            ) : error ? (
                <div className="text-sm text-red-500">加载失败: {error}</div>
            ) : (
                <Select
                    label="任务类型"
                    selectedKeys={data.taskType ? [data.taskType] : []}
                    size="sm"
                    onSelectionChange={keys => {
                        const selected = Array.from(keys)[0] as TaskHandlerType;

                        onChange({ taskType: selected, params: {} });
                    }}
                >
                    {taskRegistry.map(task => (
                        <SelectItem key={task.name} textValue={task.displayName}>
                            <div className="flex items-center gap-2">
                                {task.uiConfig?.icon && <span>{task.uiConfig.icon}</span>}
                                <div>
                                    <div className="font-medium">{task.displayName}</div>
                                    {task.description && <div className="text-xs text-gray-500">{task.description}</div>}
                                </div>
                            </div>
                        </SelectItem>
                    ))}
                </Select>
            )}

            {/* 任务参数部分 - 使用动态表单 */}
            {data.taskType && currentTaskMetadata?.uiConfig?.formFields && (
                <div className="border-t border-divider pt-3 mt-2">
                    <p className="text-xs font-semibold mb-2 text-default-600">任务参数</p>
                    <DynamicParamsForm
                        formFields={currentTaskMetadata.uiConfig.formFields}
                        values={data.params || {}}
                        onChange={handleParamChange}
                    />
                    <p className="text-xs text-default-500 mt-2">未填写的参数将使用全局默认值或从执行上下文中获取</p>
                </div>
            )}

            {/* 基础配置 */}
            <div className="border-t border-divider pt-3 mt-2">
                <p className="text-xs font-semibold mb-2 text-default-600">基础配置</p>

                <Input label="重试次数" size="sm" type="number" value={String(data.retryCount || 0)} onChange={e => onChange({ retryCount: parseInt(e.target.value) || 0 })} />

                <Input
                    className="mt-3"
                    description="0 表示无超时限制"
                    label="超时时间 (毫秒)"
                    size="sm"
                    type="number"
                    value={String(data.timeoutMs || 0)}
                    onChange={e => onChange({ timeoutMs: parseInt(e.target.value) || 0 })}
                />

                <Switch className="mt-3" isSelected={data.skipOnFailure || false} size="sm" onValueChange={checked => onChange({ skipOnFailure: checked })}>
                    失败后跳过（不终止流程）
                </Switch>
            </div>
        </div>
    );
};
