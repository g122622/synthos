/**
 * 脚本节点属性表单
 *
 * 使用 Monaco Editor 编辑脚本代码
 */

import type { WorkflowNodeData } from "../../types/index";

import React from "react";
import { Input } from "@heroui/react";
import Editor from "@monaco-editor/react";

interface ScriptPropertyFormProps {
    data: WorkflowNodeData;
    onChange: (updates: Partial<WorkflowNodeData>) => void;
}

/**
 * 脚本属性表单组件
 */
export const ScriptPropertyForm: React.FC<ScriptPropertyFormProps> = ({ data, onChange }) => {
    return (
        <div className="flex flex-col gap-3">
            <Input label="节点名称" size="sm" value={data.label} onChange={e => onChange({ label: e.target.value })} />

            <div className="flex flex-col gap-2">
                <p className="text-xs text-default-500">脚本代码</p>
                <div className="border border-default-200 rounded-md overflow-hidden">
                    <Editor
                        height="300px"
                        language="javascript"
                        options={{
                            minimap: { enabled: false },
                            fontSize: 12,
                            lineNumbers: "on",
                            scrollBeyondLastLine: false,
                            automaticLayout: true
                        }}
                        theme="vs-dark"
                        value={data.scriptCode || "// 在此编写脚本代码\nconsole.log('Hello, World!');"}
                        onChange={value => onChange({ scriptCode: value || "" })}
                    />
                </div>
            </div>
        </div>
    );
};
