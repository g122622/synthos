/**
 * 调度器配置区域
 */
import type { SectionProps } from "../../types";

import React from "react";

import { getNestedValue } from "../../utils";
import { NumberInput } from "../inputs";

/**
 * 获取字段错误
 */
const getFieldError = (errors: SectionProps["errors"], path: string): string | undefined => {
    const error = errors.find(e => e.path === path);

    return error?.message;
};

const OrchestratorSection: React.FC<SectionProps> = ({ config, errors, onFieldChange }) => {
    return (
        <div className="space-y-6">
            <div className="grid gap-4">
                <NumberInput
                    description="Pipeline 执行间隔（分钟）"
                    error={getFieldError(errors, "orchestrator.pipelineIntervalInMinutes")}
                    label="Pipeline 执行间隔（分钟）"
                    min={1}
                    path="orchestrator.pipelineIntervalInMinutes"
                    value={(getNestedValue(config, "orchestrator.pipelineIntervalInMinutes") as number) || 0}
                    onChange={onFieldChange}
                />
                <NumberInput
                    description="数据时间窗口（小时）"
                    error={getFieldError(errors, "orchestrator.dataSeekTimeWindowInHours")}
                    label="数据时间窗口（小时）"
                    min={1}
                    path="orchestrator.dataSeekTimeWindowInHours"
                    value={(getNestedValue(config, "orchestrator.dataSeekTimeWindowInHours") as number) || 0}
                    onChange={onFieldChange}
                />
            </div>
        </div>
    );
};

export default OrchestratorSection;
