/**
 * 群配置区域
 */
import type { SectionProps } from "../../types";

import React from "react";

import { getNestedValue } from "../../utils";
import { RecordEditor } from "../editors";

const GroupConfigsSection: React.FC<SectionProps> = ({ config, errors, onFieldChange }) => {
    return (
        <div className="space-y-6">
            <RecordEditor
                errors={errors}
                itemSchema="GroupConfig"
                path="groupConfigs"
                value={(getNestedValue(config, "groupConfigs") as Record<string, unknown>) || {}}
                onChange={onFieldChange}
                onFieldChange={onFieldChange}
            />
        </div>
    );
};

export default GroupConfigsSection;
