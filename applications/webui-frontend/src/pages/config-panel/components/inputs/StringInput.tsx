/**
 * 字符串输入组件
 */
import type { StringInputProps } from "../../types";

import React, { useState } from "react";
import { Input } from "@heroui/input";
import { Eye, EyeOff } from "lucide-react";

import { isSensitiveField } from "../../utils";

const StringInput: React.FC<StringInputProps> = ({ label, path, value, description, onChange, error }) => {
    const [showPassword, setShowPassword] = useState(false);
    const isSensitive = isSensitiveField(path);

    return (
        <div className="flex items-center">
            <label className="text-sm font-medium w-40 shrink-0">{label}</label>
            <Input
                description={description}
                endContent={
                    isSensitive && (
                        <button className="focus:outline-none" type="button" onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? <EyeOff className="w-4 h-4 text-default-400" /> : <Eye className="w-4 h-4 text-default-400" />}
                        </button>
                    )
                }
                errorMessage={error}
                isInvalid={!!error}
                type={isSensitive && !showPassword ? "password" : "text"}
                value={value || ""}
                onChange={e => onChange(path, e.target.value)}
            />
        </div>
    );
};

export default StringInput;
