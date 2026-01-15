/**
 * 布尔开关组件
 */
import type { BooleanSwitchProps } from "../../types/index";

import React from "react";
import { Switch } from "@heroui/switch";

/**
 * 布尔类型配置项的开关组件
 */
const BooleanSwitch: React.FC<BooleanSwitchProps> = ({ label, labelNode, path, value, description, onChange }) => {
    return (
        <div className="flex items-center min-h-8">
            <label className="text-sm font-medium w-40 shrink-0">{labelNode || label}</label>
            <div className="flex items-center gap-2">
                <Switch isSelected={!!value} size="sm" onValueChange={v => onChange(path, v)} />
                {description && <span className="text-xs text-default-500">{description}</span>}
            </div>
        </div>
    );
};

export default BooleanSwitch;
