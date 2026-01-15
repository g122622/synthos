/**
 * 字符串输入组件
 */
import type { StringInputProps } from "../../types/index";

import React, { useState } from "react";
import { Input } from "@heroui/input";
import { Eye, EyeOff } from "lucide-react";

import { isSensitiveField } from "../../utils/index";

/**
 * 字符串类型配置项的输入组件
 * 支持普通文本和敏感字段（密码形式显示）
 */
const StringInput: React.FC<StringInputProps> = ({ label, labelNode, path, value, description, onChange, error }) => {
    const [showPassword, setShowPassword] = useState(false);
    const isSensitive = isSensitiveField(path);

    return (
        <div className="flex items-center min-h-8">
            <label className="text-sm font-medium w-40 shrink-0">{labelNode || label}</label>
            <Input
                classNames={{
                    inputWrapper: "h-8 min-h-8",
                    input: "text-xs",
                    description: "text-xs",
                    errorMessage: "text-xs"
                }}
                description={description}
                endContent={
                    isSensitive && (
                        <button className="focus:outline-none" type="button" onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? <EyeOff className="w-3 h-3 text-default-400" /> : <Eye className="w-3 h-3 text-default-400" />}
                        </button>
                    )
                }
                errorMessage={error}
                isInvalid={!!error}
                size="sm"
                type={isSensitive && !showPassword ? "password" : "text"}
                value={value || ""}
                onChange={e => onChange(path, e.target.value)}
            />
        </div>
    );
};

export default StringInput;
