/**
 * 数字输入组件
 */
import type { NumberInputProps } from "../../types/index";

import React from "react";
import { Input } from "@heroui/input";

/**
 * 数字类型配置项的输入组件
 */
const NumberInput: React.FC<NumberInputProps> = ({ label, labelNode, path, value, description, min, max, onChange, error }) => {
    return (
        <div className="flex items-center">
            <label className="text-sm font-medium w-40 shrink-0">{labelNode || label}</label>
            <Input
                description={description}
                errorMessage={error}
                isInvalid={!!error}
                max={max}
                min={min}
                type="number"
                value={value?.toString() || "0"}
                onChange={e => onChange(path, parseFloat(e.target.value) || 0)}
            />
        </div>
    );
};

export default NumberInput;
