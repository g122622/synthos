/**
 * 枚举选择组件
 */
import type { EnumSelectProps } from "../../types/index";

import React from "react";
import { Select, SelectItem } from "@heroui/select";

/**
 * 枚举类型配置项的下拉选择组件
 */
const EnumSelect: React.FC<EnumSelectProps> = ({ label, labelNode, path, value, options, description, onChange, error }) => {
    return (
        <div className="flex items-center min-h-8">
            <label className="text-sm font-medium w-40 shrink-0">{labelNode || label}</label>
            <Select
                classNames={{
                    trigger: "h-8 min-h-8",
                    value: "text-xs",
                    description: "text-xs",
                    errorMessage: "text-xs"
                }}
                description={description}
                errorMessage={error}
                isInvalid={!!error}
                selectedKeys={value ? [value] : []}
                size="sm"
                onSelectionChange={keys => {
                    const selected = Array.from(keys)[0];

                    if (selected) {
                        onChange(path, selected.toString());
                    }
                }}
            >
                {options.map(option => (
                    <SelectItem key={option} className="text-xs">
                        {option}
                    </SelectItem>
                ))}
            </Select>
        </div>
    );
};

export default EnumSelect;
