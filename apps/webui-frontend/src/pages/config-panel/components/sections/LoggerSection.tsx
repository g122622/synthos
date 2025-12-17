/**
 * 日志配置区域
 */
import type { SectionProps } from "../../types";

import React from "react";

import { getNestedValue } from "../../utils";
import { StringInput, EnumSelect } from "../inputs";

/**
 * 获取字段错误
 */
const getFieldError = (errors: SectionProps["errors"], path: string): string | undefined => {
    const error = errors.find(e => e.path === path);

    return error?.message;
};

const LoggerSection: React.FC<SectionProps> = ({ config, errors, onFieldChange }) => {
    return (
        <div className="space-y-6">
            <div className="grid gap-4">
                <div className="space-y-1">
                    <label className="text-sm font-medium">日志级别</label>
                    <EnumSelect
                        description="日志级别"
                        error={getFieldError(errors, "logger.logLevel")}
                        options={["debug", "info", "success", "warning", "error"]}
                        path="logger.logLevel"
                        value={(getNestedValue(config, "logger.logLevel") as string) || "info"}
                        onChange={onFieldChange}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium">日志目录</label>
                    <StringInput
                        description="日志目录"
                        error={getFieldError(errors, "logger.logDirectory")}
                        path="logger.logDirectory"
                        value={(getNestedValue(config, "logger.logDirectory") as string) || ""}
                        onChange={onFieldChange}
                    />
                </div>
            </div>
        </div>
    );
};

export default LoggerSection;
