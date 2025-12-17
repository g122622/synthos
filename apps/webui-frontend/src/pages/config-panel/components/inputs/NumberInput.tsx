/**
 * 数字输入组件
 */
import type { NumberInputProps } from "../../types";

import React from "react";
import { Input } from "@heroui/input";

const NumberInput: React.FC<NumberInputProps> = ({ path, value, description, min, max, onChange, error }) => {
    return (
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
    );
};

export default NumberInput;
