/**
 * 后端配置区域
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

const WebUIBackendSection: React.FC<SectionProps> = ({ config, errors, onFieldChange }) => {
    return (
        <div className="space-y-6">
            <div className="grid gap-4">
                <div className="space-y-1">
                    <label className="text-sm font-medium">后端服务端口</label>
                    <NumberInput
                        description="后端服务端口"
                        error={getFieldError(errors, "webUI_Backend.port")}
                        max={65535}
                        min={1}
                        path="webUI_Backend.port"
                        value={(getNestedValue(config, "webUI_Backend.port") as number) || 0}
                        onChange={onFieldChange}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium">KV 存储基础路径</label>
                    <StringInput
                        description="KV 存储基础路径"
                        error={getFieldError(errors, "webUI_Backend.kvStoreBasePath")}
                        path="webUI_Backend.kvStoreBasePath"
                        value={(getNestedValue(config, "webUI_Backend.kvStoreBasePath") as string) || ""}
                        onChange={onFieldChange}
                    />
                </div>
            </div>
        </div>
    );
};

export default WebUIBackendSection;
