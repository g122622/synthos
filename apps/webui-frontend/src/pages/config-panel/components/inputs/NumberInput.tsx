/**
 * 数字输入组件
 */
import type { NumberInputProps } from "../../types";

import React from "react";
import { Input } from "@heroui/input";

const NumberInput: React.FC<NumberInputProps> = ({ label, path, value, description, min, max, onChange, error }) => {
    return (
        <div className="flex items-center">
            <label className="text-sm font-medium w-40 shrink-0">{label}</label>
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
