/**
 * 枚举选择组件
 */
import type { EnumSelectProps } from "../../types";

import React from "react";
import { Select, SelectItem } from "@heroui/select";

const EnumSelect: React.FC<EnumSelectProps> = ({ path, value, options, description, onChange, error }) => {
    return (
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
    );
};

export default EnumSelect;
