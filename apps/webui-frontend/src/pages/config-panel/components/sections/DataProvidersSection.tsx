/**
 * 数据源配置区域
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

const DataProvidersSection: React.FC<SectionProps> = ({ config, errors, onFieldChange }) => {
    return (
        <div className="space-y-6">
            <h4 className="text-md font-semibold">QQ 数据源</h4>
            <div className="grid gap-4">
                <StringInput
                    description="sqlite vfs 扩展路径"
                    error={getFieldError(errors, "dataProviders.QQ.VFSExtPath")}
                    label="SQLite VFS 扩展路径"
                    path="dataProviders.QQ.VFSExtPath"
                    value={(getNestedValue(config, "dataProviders.QQ.VFSExtPath") as string) || ""}
                    onChange={onFieldChange}
                />
                <StringInput
                    description="NTQQ 存放数据库的文件夹路径"
                    error={getFieldError(errors, "dataProviders.QQ.dbBasePath")}
                    label="数据库基础路径"
                    path="dataProviders.QQ.dbBasePath"
                    value={(getNestedValue(config, "dataProviders.QQ.dbBasePath") as string) || ""}
                    onChange={onFieldChange}
                />
                <StringInput
                    description="NTQQ 的数据库密钥"
                    error={getFieldError(errors, "dataProviders.QQ.dbKey")}
                    label="数据库密钥"
                    path="dataProviders.QQ.dbKey"
                    value={(getNestedValue(config, "dataProviders.QQ.dbKey") as string) || ""}
                    onChange={onFieldChange}
                />
                <BooleanSwitch
                    description="是否启用数据库补丁"
                    label="启用数据库补丁"
                    path="dataProviders.QQ.dbPatch.enabled"
                    value={(getNestedValue(config, "dataProviders.QQ.dbPatch.enabled") as boolean) || false}
                    onChange={onFieldChange}
                />
                <StringInput
                    description="数据库补丁的 SQL 语句（可选）"
                    error={getFieldError(errors, "dataProviders.QQ.dbPatch.patchSQL")}
                    label="补丁 SQL 语句"
                    path="dataProviders.QQ.dbPatch.patchSQL"
                    value={(getNestedValue(config, "dataProviders.QQ.dbPatch.patchSQL") as string) || ""}
                    onChange={onFieldChange}
                />
            </div>
        </div>
    );
};

export default DataProvidersSection;
