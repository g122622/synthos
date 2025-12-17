/**
 * 预处理器配置区域
 */
import type { SectionProps } from "../../types";

import React from "react";

import { getNestedValue } from "../../utils";
import { StringInput, NumberInput, EnumSelect } from "../inputs";

/**
 * 获取字段错误
 */
const getFieldError = (errors: SectionProps["errors"], path: string): string | undefined => {
    const error = errors.find(e => e.path === path);

    return error?.message;
};

const PreprocessorsSection: React.FC<SectionProps> = ({ config, errors, onFieldChange }) => {
    return (
        <div className="space-y-6">
            <div>
                <h4 className="text-md font-semibold mb-4">累积分割器</h4>
                <div className="grid gap-4">
                    <EnumSelect
                        description="分割模式"
                        error={getFieldError(errors, "preprocessors.AccumulativeSplitter.mode")}
                        label="分割模式"
                        options={["charCount", "messageCount"]}
                        path="preprocessors.AccumulativeSplitter.mode"
                        value={(getNestedValue(config, "preprocessors.AccumulativeSplitter.mode") as string) || "charCount"}
                        onChange={onFieldChange}
                    />
                    <NumberInput
                        description="最大字符数"
                        error={getFieldError(errors, "preprocessors.AccumulativeSplitter.maxCharCount")}
                        label="最大字符数"
                        min={1}
                        path="preprocessors.AccumulativeSplitter.maxCharCount"
                        value={(getNestedValue(config, "preprocessors.AccumulativeSplitter.maxCharCount") as number) || 0}
                        onChange={onFieldChange}
                    />
                    <NumberInput
                        description="最大消息数"
                        error={getFieldError(errors, "preprocessors.AccumulativeSplitter.maxMessageCount")}
                        label="最大消息数"
                        min={1}
                        path="preprocessors.AccumulativeSplitter.maxMessageCount"
                        value={(getNestedValue(config, "preprocessors.AccumulativeSplitter.maxMessageCount") as number) || 0}
                        onChange={onFieldChange}
                    />
                    <StringInput
                        description="持久化 KVStore 路径"
                        error={getFieldError(errors, "preprocessors.AccumulativeSplitter.persistentKVStorePath")}
                        label="持久化 KVStore 路径"
                        path="preprocessors.AccumulativeSplitter.persistentKVStorePath"
                        value={(getNestedValue(config, "preprocessors.AccumulativeSplitter.persistentKVStorePath") as string) || ""}
                        onChange={onFieldChange}
                    />
                </div>
            </div>
            <div>
                <h4 className="text-md font-semibold mb-4">超时分割器</h4>
                <div className="grid gap-4">
                    <NumberInput
                        description="超时时间（分钟）"
                        error={getFieldError(errors, "preprocessors.TimeoutSplitter.timeoutInMinutes")}
                        label="超时时间（分钟）"
                        min={1}
                        path="preprocessors.TimeoutSplitter.timeoutInMinutes"
                        value={(getNestedValue(config, "preprocessors.TimeoutSplitter.timeoutInMinutes") as number) || 0}
                        onChange={onFieldChange}
                    />
                </div>
            </div>
        </div>
    );
};

export default PreprocessorsSection;
