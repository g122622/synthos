/**
 * 枚举选择组件
 */
import type { EnumSelectProps } from "../../types";

import React from "react";
import { Select, SelectItem } from "@heroui/select";

const EnumSelect: React.FC<EnumSelectProps> = ({ label, path, value, options, description, onChange, error }) => {
    return (
        <div className="flex items-center">
            <label className="text-sm font-medium w-40 shrink-0">{label}</label>
            <Select
                description={description}
                errorMessage={error}
                isInvalid={!!error}
                selectedKeys={value ? [value] : []}
                onSelectionChange={keys => {
                    const selected = Array.from(keys)[0];

                    if (selected) {
                        onChange(path, selected.toString());
                    }
                }}
            >
                {options.map(option => (
                    <SelectItem key={option}>{option}</SelectItem>
                ))}
            </Select>
        </div>
    );
};

export default EnumSelect;
