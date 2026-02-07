/**
 * HTTP 节点属性表单
 *
 * 编辑 URL、Method、Headers、Body
 */

import type { HttpMethod, WorkflowNodeData } from "../../types/index";

import React from "react";
import { Input, Select, SelectItem, Button } from "@heroui/react";
import { Plus, Trash2 } from "lucide-react";

interface HttpPropertyFormProps {
    data: WorkflowNodeData;
    onChange: (updates: Partial<WorkflowNodeData>) => void;
}

/**
 * HTTP 方法选项
 */
const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "DELETE", "PATCH"];

/**
 * HTTP 属性表单组件
 */
export const HttpPropertyForm: React.FC<HttpPropertyFormProps> = ({ data, onChange }) => {
    const httpConfig = data.httpConfig || { method: "GET", url: "", headers: {}, body: "" };
    const headers = httpConfig.headers || {};
    const headerEntries = Object.entries(headers);

    const updateHttpConfig = (updates: Partial<typeof httpConfig>) => {
        onChange({ httpConfig: { ...httpConfig, ...updates } });
    };

    const addHeader = () => {
        const newHeaders = { ...headers, "": "" };

        updateHttpConfig({ headers: newHeaders });
    };

    const updateHeader = (oldKey: string, newKey: string, value: string) => {
        const newHeaders = { ...headers };

        if (oldKey !== newKey) {
            delete newHeaders[oldKey];
        }
        newHeaders[newKey] = value;
        updateHttpConfig({ headers: newHeaders });
    };

    const deleteHeader = (key: string) => {
        const newHeaders = { ...headers };

        delete newHeaders[key];
        updateHttpConfig({ headers: newHeaders });
    };

    return (
        <div className="flex flex-col gap-3">
            <Input label="节点名称" size="sm" value={data.label} onChange={e => onChange({ label: e.target.value })} />

            <Select
                label="HTTP 方法"
                selectedKeys={[httpConfig.method]}
                size="sm"
                onSelectionChange={keys => {
                    const selected = Array.from(keys)[0] as HttpMethod;

                    updateHttpConfig({ method: selected });
                }}
            >
                {HTTP_METHODS.map(method => (
                    <SelectItem key={method}>{method}</SelectItem>
                ))}
            </Select>

            <Input label="URL" placeholder="https://api.example.com/endpoint" size="sm" value={httpConfig.url} onChange={e => updateHttpConfig({ url: e.target.value })} />

            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <p className="text-xs text-default-500">请求头 (Headers)</p>
                    <Button isIconOnly size="sm" variant="light" onPress={addHeader}>
                        <Plus className="w-4 h-4" />
                    </Button>
                </div>

                <div className="flex flex-col gap-2">
                    {headerEntries.map(([key, value], index) => (
                        <div key={index} className="flex items-center gap-2">
                            <Input className="flex-1" placeholder="Key" size="sm" value={key} onChange={e => updateHeader(key, e.target.value, value as string)} />
                            <Input className="flex-1" placeholder="Value" size="sm" value={value as string} onChange={e => updateHeader(key, key, e.target.value)} />
                            <Button isIconOnly color="danger" size="sm" variant="light" onPress={() => deleteHeader(key)}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            </div>

            {(httpConfig.method === "POST" || httpConfig.method === "PUT" || httpConfig.method === "PATCH") && (
                <div className="flex flex-col gap-2">
                    <p className="text-xs text-default-500">请求体 (Body)</p>
                    <textarea
                        className="w-full p-2 text-xs font-mono bg-default-100 border border-default-200 rounded-md"
                        placeholder='{"key": "value"}'
                        rows={6}
                        value={httpConfig.body || ""}
                        onChange={e => updateHttpConfig({ body: e.target.value })}
                    />
                </div>
            )}
        </div>
    );
};
