/**
 * 布尔开关组件
 */
import type { BooleanSwitchProps } from "../../types";

import React from "react";
import { Switch } from "@heroui/switch";

const BooleanSwitch: React.FC<BooleanSwitchProps> = ({ path, value, description, onChange }) => {
    return (
        <div className="flex items-center gap-2">
            <Switch isSelected={!!value} onValueChange={v => onChange(path, v)} />
            {description && <span className="text-sm text-default-500">{description}</span>}
        </div>
    );
};

export default BooleanSwitch;
