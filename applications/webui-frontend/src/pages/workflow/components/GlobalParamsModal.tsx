/**
 * 工作流全局参数设置模态框
 *
 * 用于编辑 orchestrator.defaultTimeRangeInHours、defaultGroupIds、defaultIMType
 */

import React from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input, Select, SelectItem, Chip } from "@heroui/react";
import { X } from "lucide-react";

import { Notification } from "@/util/Notification";

interface GlobalParamsModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultTimeRangeInHours: number;
    defaultGroupIds: string[];
    defaultIMType: string;
    onSave: (params: { defaultTimeRangeInHours: number; defaultGroupIds: string[]; defaultIMType: string }) => Promise<void>;
}

/**
 * IM 类型选项
 */
const IM_TYPES = [
    { value: "QQ", label: "QQ" },
    { value: "WeChat", label: "微信" },
    { value: "钉钉", label: "钉钉" }
];

/**
 * 全局参数设置模态框组件
 */
export const GlobalParamsModal: React.FC<GlobalParamsModalProps> = ({ isOpen, onClose, defaultTimeRangeInHours, defaultGroupIds, defaultIMType, onSave }) => {
    const [timeRange, setTimeRange] = React.useState(defaultTimeRangeInHours);
    const [groupIds, setGroupIds] = React.useState<string[]>(defaultGroupIds);
    const [imType, setImType] = React.useState(defaultIMType);
    const [groupIdInput, setGroupIdInput] = React.useState("");
    const [isSaving, setIsSaving] = React.useState(false);

    // 每次打开模态框时，重置为传入的初始值
    React.useEffect(() => {
        if (isOpen) {
            setTimeRange(defaultTimeRangeInHours);
            setGroupIds(defaultGroupIds);
            setImType(defaultIMType);
            setGroupIdInput("");
        }
    }, [isOpen, defaultTimeRangeInHours, defaultGroupIds, defaultIMType]);

    // 添加群组 ID
    const handleAddGroupId = () => {
        if (!groupIdInput.trim()) {
            return;
        }

        if (groupIds.includes(groupIdInput.trim())) {
            // 群组ID已存在，静默忽略或使用 error
            return;
        }

        setGroupIds([...groupIds, groupIdInput.trim()]);
        setGroupIdInput("");
    };

    // 删除群组 ID
    const handleRemoveGroupId = (index: number) => {
        setGroupIds(groupIds.filter((_, i) => i !== index));
    };

    // 保存配置
    const handleSave = async () => {
        if (timeRange <= 0) {
            Notification.error({ title: "时间范围必须大于 0" });

            return;
        }

        setIsSaving(true);
        try {
            await onSave({
                defaultTimeRangeInHours: timeRange,
                defaultGroupIds: groupIds,
                defaultIMType: imType
            });
            Notification.success({ title: "全局参数已保存" });
            onClose();
        } catch (error) {
            console.error("保存全局参数失败:", error);
            Notification.error({ title: "保存全局参数失败" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} scrollBehavior="inside" size="lg" onClose={onClose}>
            <ModalContent>
                <ModalHeader>
                    <div className="flex flex-col gap-1">
                        <h3 className="text-lg font-semibold">工作流全局参数设置</h3>
                        <p className="text-xs text-default-500 font-normal">这些参数将作为任务节点未指定参数时的默认值</p>
                    </div>
                </ModalHeader>
                <ModalBody>
                    <div className="flex flex-col gap-4">
                        {/* 默认时间范围 */}
                        <Input
                            description='任务未指定时间范围时，自动使用"当前时间 - N 小时"作为时间范围'
                            label="默认时间范围（小时）"
                            size="sm"
                            type="number"
                            value={String(timeRange)}
                            onChange={e => setTimeRange(parseInt(e.target.value) || 0)}
                        />

                        {/* 默认 IM 类型 */}
                        <Select description="ProvideData 任务未指定 IM 类型时使用" label="默认 IM 类型" selectedKeys={[imType]} size="sm" onSelectionChange={keys => setImType(Array.from(keys)[0] as string)}>
                            {IM_TYPES.map(type => (
                                <SelectItem key={type.value}>{type.label}</SelectItem>
                            ))}
                        </Select>

                        {/* 默认群组 ID 列表 */}
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-default-700">默认群组 ID 列表</label>
                            <p className="text-xs text-default-500">任务未指定群组列表时使用，留空表示处理所有群组</p>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="输入群组 ID"
                                    size="sm"
                                    value={groupIdInput}
                                    onChange={e => setGroupIdInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === "Enter") {
                                            handleAddGroupId();
                                        }
                                    }}
                                />
                                <Button color="primary" size="sm" onPress={handleAddGroupId}>
                                    添加
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-1 min-h-[4rem] p-3 border border-divider rounded-lg bg-default-50">
                                {groupIds.length === 0 ? (
                                    <span className="text-xs text-default-400">暂无默认群组（将处理所有群组）</span>
                                ) : (
                                    groupIds.map((id, index) => (
                                        <Chip key={index} endContent={<X className="cursor-pointer" size={14} onClick={() => handleRemoveGroupId(index)} />} size="sm" variant="flat">
                                            {id}
                                        </Chip>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button color="default" size="sm" variant="light" onPress={onClose}>
                        取消
                    </Button>
                    <Button color="primary" isLoading={isSaving} size="sm" onPress={handleSave}>
                        保存
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};
