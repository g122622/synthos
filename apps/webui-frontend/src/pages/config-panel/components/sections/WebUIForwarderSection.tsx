/**
 * 内网穿透配置区域
 */
import type { SectionProps } from "../../types";

import React from "react";

import { getNestedValue } from "../../utils";
import { StringInput, BooleanSwitch } from "../inputs";

/**
 * 获取字段错误
 */
const getFieldError = (errors: SectionProps["errors"], path: string): string | undefined => {
    const error = errors.find(e => e.path === path);

    return error?.message;
};

const WebUIForwarderSection: React.FC<SectionProps> = ({ config, errors, onFieldChange }) => {
    return (
        <div className="space-y-6">
            <div className="grid gap-4">
                <div className="space-y-1">
                    <label className="text-sm font-medium">启用内网穿透</label>
                    <BooleanSwitch
                        description="是否启用内网穿透"
                        path="webUI_Forwarder.enabled"
                        value={(getNestedValue(config, "webUI_Forwarder.enabled") as boolean) || false}
                        onChange={onFieldChange}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium">前端 ngrok Token</label>
                    <StringInput
                        description="前端 ngrok Token（可选）"
                        error={getFieldError(errors, "webUI_Forwarder.authTokenForFE")}
                        path="webUI_Forwarder.authTokenForFE"
                        value={(getNestedValue(config, "webUI_Forwarder.authTokenForFE") as string) || ""}
                        onChange={onFieldChange}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium">后端 ngrok Token</label>
                    <StringInput
                        description="后端 ngrok Token（可选）"
                        error={getFieldError(errors, "webUI_Forwarder.authTokenForBE")}
                        path="webUI_Forwarder.authTokenForBE"
                        value={(getNestedValue(config, "webUI_Forwarder.authTokenForBE") as string) || ""}
                        onChange={onFieldChange}
                    />
                </div>
            </div>
        </div>
    );
};

export default WebUIForwarderSection;
