/**
 * 公共数据库配置区域
 */
import type { SectionProps } from "../../types";

import React from "react";

import { getNestedValue } from "../../utils";
import { StringInput, NumberInput } from "../inputs";

/**
 * 获取字段错误
 */
const getFieldError = (errors: SectionProps["errors"], path: string): string | undefined => {
    const error = errors.find(e => e.path === path);

    return error?.message;
};

const CommonDatabaseSection: React.FC<SectionProps> = ({ config, errors, onFieldChange }) => {
    return (
        <div className="space-y-6">
            <div className="grid gap-4">
                <div className="space-y-1">
                    <label className="text-sm font-medium">数据库基础路径</label>
                    <StringInput
                        description="数据库基础路径"
                        error={getFieldError(errors, "commonDatabase.dbBasePath")}
                        path="commonDatabase.dbBasePath"
                        value={(getNestedValue(config, "commonDatabase.dbBasePath") as string) || ""}
                        onChange={onFieldChange}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium">最大数据库持续时间（天）</label>
                    <NumberInput
                        description="最大数据库持续时间（天）"
                        error={getFieldError(errors, "commonDatabase.maxDBDuration")}
                        min={1}
                        path="commonDatabase.maxDBDuration"
                        value={(getNestedValue(config, "commonDatabase.maxDBDuration") as number) || 0}
                        onChange={onFieldChange}
                    />
                </div>
            </div>
        </div>
    );
};

export default CommonDatabaseSection;
