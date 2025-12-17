/**
 * 配置面板页面
 * 支持可视化编辑全局配置
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import { Spinner } from "@heroui/spinner";
import { Chip } from "@heroui/chip";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Trash2, Plus, Eye, EyeOff, Save, RotateCcw, AlertCircle, CheckCircle } from "lucide-react";

import { getCurrentConfig, saveOverrideConfig, validateConfig } from "@/api/configApi";
import { title } from "@/components/primitives";
import DefaultLayout from "@/layouts/default";

// ==================== 类型定义 ====================

interface ValidationError {
    path: string;
    message: string;
}

interface SectionConfig {
    key: string;
    label: string;
    icon: string;
}

// ==================== 配置分类定义 ====================

const CONFIG_SECTIONS: SectionConfig[] = [
    { key: "dataProviders", label: "数据源配置", icon: "📊" },
    { key: "preprocessors", label: "预处理器配置", icon: "⚙️" },
    { key: "ai", label: "AI 配置", icon: "🤖" },
    { key: "webUI_Backend", label: "后端配置", icon: "🖥️" },
    { key: "orchestrator", label: "调度器配置", icon: "📅" },
    { key: "webUI_Forwarder", label: "内网穿透配置", icon: "🌐" },
    { key: "commonDatabase", label: "公共数据库配置", icon: "💾" },
    { key: "logger", label: "日志配置", icon: "📝" },
    { key: "groupConfigs", label: "群配置", icon: "👥" }
];

// 敏感字段路径列表
const SENSITIVE_FIELDS = ["dataProviders.QQ.dbKey", "ai.models.*.apiKey", "ai.defaultModelConfig.apiKey", "webUI_Forwarder.authTokenForFE", "webUI_Forwarder.authTokenForBE"];

// ==================== 工具函数 ====================

/**
 * 判断字段是否为敏感字段
 */
const isSensitiveField = (path: string): boolean => {
    return SENSITIVE_FIELDS.some(pattern => {
        const regexPattern = pattern.replace(/\*/g, "[^.]+");

        return new RegExp(`^${regexPattern}$`).test(path);
    });
};

/**
 * 深度获取对象值
 */
const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
    return path.split(".").reduce((acc: unknown, key) => {
        if (acc && typeof acc === "object") {
            return (acc as Record<string, unknown>)[key];
        }

        return undefined;
    }, obj);
};

/**
 * 深度设置对象值
 */
const setNestedValue = (obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> => {
    const keys = path.split(".");
    const result = { ...obj };
    let current: Record<string, unknown> = result;

    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];

        if (!(key in current) || typeof current[key] !== "object" || current[key] === null) {
            current[key] = {};
        } else {
            current[key] = { ...(current[key] as Record<string, unknown>) };
        }
        current = current[key] as Record<string, unknown>;
    }

    current[keys[keys.length - 1]] = value;

    return result;
};

// ==================== 子组件 ====================

/**
 * 字符串输入组件
 */
const StringInput: React.FC<{
    path: string;
    value: string;
    description?: string;
    onChange: (path: string, value: string) => void;
    error?: string;
}> = ({ path, value, description, onChange, error }) => {
    const [showPassword, setShowPassword] = useState(false);
    const isSensitive = isSensitiveField(path);

    return (
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
    );
};

/**
 * 数字输入组件
 */
const NumberInput: React.FC<{
    path: string;
    value: number;
    description?: string;
    min?: number;
    max?: number;
    onChange: (path: string, value: number) => void;
    error?: string;
}> = ({ path, value, description, min, max, onChange, error }) => {
    return (
        <Input
            description={description}
            errorMessage={error}
            isInvalid={!!error}
            max={max}
            min={min}
            type="number"
            value={value?.toString() || "0"}
            onChange={e => onChange(path, parseFloat(e.target.value) || 0)}
        />
    );
};

/**
 * 布尔开关组件
 */
const BooleanSwitch: React.FC<{
    path: string;
    value: boolean;
    description?: string;
    onChange: (path: string, value: boolean) => void;
}> = ({ path, value, description, onChange }) => {
    return (
        <div className="flex items-center gap-2">
            <Switch isSelected={!!value} onValueChange={v => onChange(path, v)} />
            {description && <span className="text-sm text-default-500">{description}</span>}
        </div>
    );
};

/**
 * 枚举选择组件
 */
const EnumSelect: React.FC<{
    path: string;
    value: string;
    options: string[];
    description?: string;
    onChange: (path: string, value: string) => void;
    error?: string;
}> = ({ path, value, options, description, onChange, error }) => {
    return (
        <Select
            description={description}
            errorMessage={error}
            isInvalid={!!error}
            selectedKeys={value ? [value] : []}
            onSelectionChange={keys => {
                const selected = Array.from(keys)[0];

                if (selected) {
                    onChange(path, selected.toString());
                }
            }}
        >
            {options.map(option => (
                <SelectItem key={option}>{option}</SelectItem>
            ))}
        </Select>
    );
};

/**
 * 字符串数组编辑组件
 */
const StringArrayEditor: React.FC<{
    path: string;
    value: string[];
    description?: string;
    onChange: (path: string, value: string[]) => void;
}> = ({ path, value, description, onChange }) => {
    const [newItem, setNewItem] = useState("");
    const items = Array.isArray(value) ? value : [];

    const addItem = () => {
        if (newItem.trim()) {
            onChange(path, [...items, newItem.trim()]);
            setNewItem("");
        }
    };

    const removeItem = (index: number) => {
        onChange(
            path,
            items.filter((_, i) => i !== index)
        );
    };

    return (
        <div className="space-y-2">
            {description && <p className="text-sm text-default-500">{description}</p>}
            <div className="flex flex-wrap gap-2">
                {items.map((item, index) => (
                    <Chip key={index} variant="flat" onClose={() => removeItem(index)}>
                        {item}
                    </Chip>
                ))}
            </div>
            <div className="flex gap-2">
                <Input placeholder="添加新项" size="sm" value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === "Enter" && addItem()} />
                <Button isIconOnly isDisabled={!newItem.trim()} size="sm" onPress={addItem}>
                    <Plus className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};

/**
 * Record（动态键值对）编辑组件
 */
const RecordEditor: React.FC<{
    path: string;
    value: Record<string, unknown>;
    itemSchema: "ModelConfig" | "GroupConfig";
    onChange: (path: string, value: Record<string, unknown>) => void;
    onFieldChange: (path: string, value: unknown) => void;
    errors: ValidationError[];
}> = ({ path, value, itemSchema, onChange, onFieldChange, errors }) => {
    const [newKey, setNewKey] = useState("");
    const items = value && typeof value === "object" ? value : {};

    const addItem = () => {
        if (newKey.trim() && !items[newKey.trim()]) {
            const defaultValue =
                itemSchema === "ModelConfig" ? { apiKey: "", baseURL: "", temperature: 0.7, maxTokens: 4096 } : { IM: "QQ", splitStrategy: "realtime", groupIntroduction: "", aiModels: [] };

            onChange(path, { ...items, [newKey.trim()]: defaultValue });
            setNewKey("");
        }
    };

    const removeItem = (key: string) => {
        const newItems = { ...items };

        delete newItems[key];
        onChange(path, newItems);
    };

    const getFieldError = (fieldPath: string): string | undefined => {
        const error = errors.find(e => e.path === fieldPath);

        return error?.message;
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <Input
                    placeholder={`添加新${itemSchema === "ModelConfig" ? "模型" : "群组"}`}
                    size="sm"
                    value={newKey}
                    onChange={e => setNewKey(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addItem()}
                />
                <Button isDisabled={!newKey.trim() || !!items[newKey.trim()]} size="sm" onPress={addItem}>
                    <Plus className="w-4 h-4 mr-1" />
                    添加
                </Button>
            </div>

            <Accordion selectionMode="multiple" variant="bordered">
                {Object.entries(items).map(([key, itemValue]) => {
                    const itemPath = `${path}.${key}`;
                    const itemData = itemValue as Record<string, unknown>;

                    return (
                        <AccordionItem
                            key={key}
                            startContent={
                                <Chip size="sm" variant="flat">
                                    {itemSchema === "ModelConfig" ? "模型" : "群组"}
                                </Chip>
                            }
                            title={
                                <div className="flex items-center justify-between w-full pr-4">
                                    <span className="font-medium">{key}</span>
                                </div>
                            }
                        >
                            <div className="space-y-4 p-2">
                                {itemSchema === "ModelConfig" ? (
                                    <>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium">API 密钥</label>
                                            <StringInput
                                                description="API 密钥"
                                                error={getFieldError(`${itemPath}.apiKey`)}
                                                path={`${itemPath}.apiKey`}
                                                value={(itemData.apiKey as string) || ""}
                                                onChange={onFieldChange}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium">API 基础 URL</label>
                                            <StringInput
                                                description="API 基础 URL"
                                                error={getFieldError(`${itemPath}.baseURL`)}
                                                path={`${itemPath}.baseURL`}
                                                value={(itemData.baseURL as string) || ""}
                                                onChange={onFieldChange}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium">温度参数</label>
                                            <NumberInput
                                                description="温度参数，控制输出的随机性"
                                                error={getFieldError(`${itemPath}.temperature`)}
                                                max={2}
                                                min={0}
                                                path={`${itemPath}.temperature`}
                                                value={(itemData.temperature as number) || 0}
                                                onChange={onFieldChange}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium">最大 Token 数量</label>
                                            <NumberInput
                                                description="最大 Token 数量"
                                                error={getFieldError(`${itemPath}.maxTokens`)}
                                                min={1}
                                                path={`${itemPath}.maxTokens`}
                                                value={(itemData.maxTokens as number) || 0}
                                                onChange={onFieldChange}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium">IM 平台</label>
                                            <EnumSelect
                                                description="IM 平台类型"
                                                error={getFieldError(`${itemPath}.IM`)}
                                                options={["QQ", "WeChat"]}
                                                path={`${itemPath}.IM`}
                                                value={(itemData.IM as string) || "QQ"}
                                                onChange={onFieldChange}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium">消息分割策略</label>
                                            <EnumSelect
                                                description="消息分割策略"
                                                error={getFieldError(`${itemPath}.splitStrategy`)}
                                                options={["realtime", "accumulative"]}
                                                path={`${itemPath}.splitStrategy`}
                                                value={(itemData.splitStrategy as string) || "realtime"}
                                                onChange={onFieldChange}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium">群简介</label>
                                            <StringInput
                                                description="群简介，用于拼接在 context 里面"
                                                error={getFieldError(`${itemPath}.groupIntroduction`)}
                                                path={`${itemPath}.groupIntroduction`}
                                                value={(itemData.groupIntroduction as string) || ""}
                                                onChange={onFieldChange}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium">AI 模型列表</label>
                                            <StringArrayEditor
                                                description="要使用的 AI 模型名列表，按优先级排序"
                                                path={`${itemPath}.aiModels`}
                                                value={(itemData.aiModels as string[]) || []}
                                                onChange={onFieldChange}
                                            />
                                        </div>
                                    </>
                                )}
                                <Button color="danger" size="sm" variant="flat" onPress={() => removeItem(key)}>
                                    <Trash2 className="w-4 h-4 mr-1" />
                                    删除
                                </Button>
                            </div>
                        </AccordionItem>
                    );
                })}
            </Accordion>
        </div>
    );
};

// ==================== 主组件 ====================

export default function ConfigPage() {
    const [config, setConfig] = useState<Record<string, unknown>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState<ValidationError[]>([]);
    const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
    const [activeSection, setActiveSection] = useState<string>("dataProviders");
    const [isScrolling, setIsScrolling] = useState(false);

    // 加载配置
    const loadConfig = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await getCurrentConfig();

            if (response.success) {
                setConfig(response.data);
            } else {
                console.error("获取配置失败:", response.message);
            }
        } catch (error) {
            console.error("获取配置失败:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadConfig();
    }, [loadConfig]);

    // 监听滚动事件，自动更新 activeSection
    useEffect(() => {
        // 如果正在程序化滚动，不更新 activeSection
        if (isScrolling) return;

        const handleScroll = () => {
            const sectionElements = CONFIG_SECTIONS.map(section => ({
                key: section.key,
                element: document.getElementById(`section-${section.key}`)
            })).filter(item => item.element !== null);

            if (sectionElements.length === 0) return;

            // 找到当前在视口中最靠近顶部的 section
            const viewportTop = window.scrollY;
            const offset = 150; // 偏移量，用于提前切换

            let currentSection = sectionElements[0].key;

            for (const { key, element } of sectionElements) {
                if (element) {
                    const rect = element.getBoundingClientRect();
                    const elementTop = rect.top + window.scrollY;

                    if (elementTop - offset <= viewportTop) {
                        currentSection = key;
                    }
                }
            }

            setActiveSection(currentSection);
        };

        // 添加滚动事件监听
        window.addEventListener("scroll", handleScroll, { passive: true });

        // 初始化时执行一次
        handleScroll();

        return () => {
            window.removeEventListener("scroll", handleScroll);
        };
    }, [isScrolling]);

    // 验证配置（防抖）
    const validateConfigDebounced = useCallback(async (newConfig: Record<string, unknown>) => {
        try {
            const response = await validateConfig(newConfig, false);

            if (response.success) {
                if (response.data.valid) {
                    setErrors([]);
                } else {
                    setErrors(response.data.errors || []);
                }
            }
        } catch (error) {
            console.error("验证配置失败:", error);
        }
    }, []);

    // 字段变更处理
    const handleFieldChange = useCallback(
        (path: string, value: unknown) => {
            setConfig(prev => {
                const newConfig = setNestedValue(prev, path, value);

                // 触发验证
                validateConfigDebounced(newConfig);

                return newConfig;
            });
            setSaveStatus("idle");
        },
        [validateConfigDebounced]
    );

    // 保存配置
    const handleSave = async () => {
        if (errors.length > 0) {
            alert("配置存在错误，请先修复后再保存");

            return;
        }

        setIsSaving(true);
        try {
            const response = await saveOverrideConfig(config);

            if (response.success) {
                setSaveStatus("success");
                setTimeout(() => setSaveStatus("idle"), 3000);
            } else {
                setSaveStatus("error");
                alert(`保存失败: ${response.message}`);
            }
        } catch (error) {
            setSaveStatus("error");
            console.error("保存配置失败:", error);
        } finally {
            setIsSaving(false);
        }
    };

    // 重置配置
    const handleReset = () => {
        if (confirm("确定要重置配置吗？所有未保存的更改将丢失。")) {
            loadConfig();
            setSaveStatus("idle");
        }
    };

    // 获取字段错误
    const getFieldError = useCallback(
        (path: string): string | undefined => {
            const error = errors.find(e => e.path === path);

            return error?.message;
        },
        [errors]
    );

    // 滚动到指定区域
    const scrollToSection = (sectionKey: string) => {
        setActiveSection(sectionKey);
        setIsScrolling(true); // 标记正在程序化滚动

        const element = document.getElementById(`section-${sectionKey}`);

        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" });

            // 滚动完成后重置标记
            setTimeout(() => {
                setIsScrolling(false);
            }, 1000); // 给足够的时间让滚动动画完成
        } else {
            setIsScrolling(false);
        }
    };

    // 渲染配置区域
    const renderSection = useMemo(() => {
        const sectionRenderers: Record<string, () => React.ReactNode> = {
            dataProviders: () => (
                <div className="space-y-6">
                    <h4 className="text-md font-semibold">QQ 数据源</h4>
                    <div className="grid gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">SQLite VFS 扩展路径</label>
                            <StringInput
                                description="sqlite vfs 扩展路径"
                                error={getFieldError("dataProviders.QQ.VFSExtPath")}
                                path="dataProviders.QQ.VFSExtPath"
                                value={(getNestedValue(config, "dataProviders.QQ.VFSExtPath") as string) || ""}
                                onChange={handleFieldChange}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">数据库基础路径</label>
                            <StringInput
                                description="NTQQ 存放数据库的文件夹路径"
                                error={getFieldError("dataProviders.QQ.dbBasePath")}
                                path="dataProviders.QQ.dbBasePath"
                                value={(getNestedValue(config, "dataProviders.QQ.dbBasePath") as string) || ""}
                                onChange={handleFieldChange}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">数据库密钥</label>
                            <StringInput
                                description="NTQQ 的数据库密钥"
                                error={getFieldError("dataProviders.QQ.dbKey")}
                                path="dataProviders.QQ.dbKey"
                                value={(getNestedValue(config, "dataProviders.QQ.dbKey") as string) || ""}
                                onChange={handleFieldChange}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">启用数据库补丁</label>
                            <BooleanSwitch
                                description="是否启用数据库补丁"
                                path="dataProviders.QQ.dbPatch.enabled"
                                value={(getNestedValue(config, "dataProviders.QQ.dbPatch.enabled") as boolean) || false}
                                onChange={handleFieldChange}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">补丁 SQL 语句</label>
                            <StringInput
                                description="数据库补丁的 SQL 语句（可选）"
                                error={getFieldError("dataProviders.QQ.dbPatch.patchSQL")}
                                path="dataProviders.QQ.dbPatch.patchSQL"
                                value={(getNestedValue(config, "dataProviders.QQ.dbPatch.patchSQL") as string) || ""}
                                onChange={handleFieldChange}
                            />
                        </div>
                    </div>
                </div>
            ),

            preprocessors: () => (
                <div className="space-y-6">
                    <div>
                        <h4 className="text-md font-semibold mb-4">累积分割器</h4>
                        <div className="grid gap-4">
                            <div className="space-y-1">
                                <label className="text-sm font-medium">分割模式</label>
                                <EnumSelect
                                    description="分割模式"
                                    error={getFieldError("preprocessors.AccumulativeSplitter.mode")}
                                    options={["charCount", "messageCount"]}
                                    path="preprocessors.AccumulativeSplitter.mode"
                                    value={(getNestedValue(config, "preprocessors.AccumulativeSplitter.mode") as string) || "charCount"}
                                    onChange={handleFieldChange}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">最大字符数</label>
                                <NumberInput
                                    description="最大字符数"
                                    error={getFieldError("preprocessors.AccumulativeSplitter.maxCharCount")}
                                    min={1}
                                    path="preprocessors.AccumulativeSplitter.maxCharCount"
                                    value={(getNestedValue(config, "preprocessors.AccumulativeSplitter.maxCharCount") as number) || 0}
                                    onChange={handleFieldChange}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">最大消息数</label>
                                <NumberInput
                                    description="最大消息数"
                                    error={getFieldError("preprocessors.AccumulativeSplitter.maxMessageCount")}
                                    min={1}
                                    path="preprocessors.AccumulativeSplitter.maxMessageCount"
                                    value={(getNestedValue(config, "preprocessors.AccumulativeSplitter.maxMessageCount") as number) || 0}
                                    onChange={handleFieldChange}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">持久化 KVStore 路径</label>
                                <StringInput
                                    description="持久化 KVStore 路径"
                                    error={getFieldError("preprocessors.AccumulativeSplitter.persistentKVStorePath")}
                                    path="preprocessors.AccumulativeSplitter.persistentKVStorePath"
                                    value={(getNestedValue(config, "preprocessors.AccumulativeSplitter.persistentKVStorePath") as string) || ""}
                                    onChange={handleFieldChange}
                                />
                            </div>
                        </div>
                    </div>
                    <div>
                        <h4 className="text-md font-semibold mb-4">超时分割器</h4>
                        <div className="grid gap-4">
                            <div className="space-y-1">
                                <label className="text-sm font-medium">超时时间（分钟）</label>
                                <NumberInput
                                    description="超时时间（分钟）"
                                    error={getFieldError("preprocessors.TimeoutSplitter.timeoutInMinutes")}
                                    min={1}
                                    path="preprocessors.TimeoutSplitter.timeoutInMinutes"
                                    value={(getNestedValue(config, "preprocessors.TimeoutSplitter.timeoutInMinutes") as number) || 0}
                                    onChange={handleFieldChange}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            ),

            ai: () => (
                <div className="space-y-6">
                    <div>
                        <h4 className="text-md font-semibold mb-4">模型配置</h4>
                        <RecordEditor
                            errors={errors}
                            itemSchema="ModelConfig"
                            path="ai.models"
                            value={(getNestedValue(config, "ai.models") as Record<string, unknown>) || {}}
                            onChange={handleFieldChange}
                            onFieldChange={handleFieldChange}
                        />
                    </div>

                    <div>
                        <h4 className="text-md font-semibold mb-4">默认模型配置</h4>
                        <div className="grid gap-4">
                            <div className="space-y-1">
                                <label className="text-sm font-medium">API 密钥</label>
                                <StringInput
                                    description="API 密钥"
                                    error={getFieldError("ai.defaultModelConfig.apiKey")}
                                    path="ai.defaultModelConfig.apiKey"
                                    value={(getNestedValue(config, "ai.defaultModelConfig.apiKey") as string) || ""}
                                    onChange={handleFieldChange}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">API 基础 URL</label>
                                <StringInput
                                    description="API 基础 URL"
                                    error={getFieldError("ai.defaultModelConfig.baseURL")}
                                    path="ai.defaultModelConfig.baseURL"
                                    value={(getNestedValue(config, "ai.defaultModelConfig.baseURL") as string) || ""}
                                    onChange={handleFieldChange}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">温度参数</label>
                                <NumberInput
                                    description="温度参数，控制输出的随机性"
                                    error={getFieldError("ai.defaultModelConfig.temperature")}
                                    max={2}
                                    min={0}
                                    path="ai.defaultModelConfig.temperature"
                                    value={(getNestedValue(config, "ai.defaultModelConfig.temperature") as number) || 0}
                                    onChange={handleFieldChange}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">最大 Token 数量</label>
                                <NumberInput
                                    description="最大 Token 数量"
                                    error={getFieldError("ai.defaultModelConfig.maxTokens")}
                                    min={1}
                                    path="ai.defaultModelConfig.maxTokens"
                                    value={(getNestedValue(config, "ai.defaultModelConfig.maxTokens") as number) || 0}
                                    onChange={handleFieldChange}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-md font-semibold mb-4">基本设置</h4>
                        <div className="grid gap-4">
                            <div className="space-y-1">
                                <label className="text-sm font-medium">默认模型名称</label>
                                <StringInput
                                    description="默认模型名称"
                                    error={getFieldError("ai.defaultModelName")}
                                    path="ai.defaultModelName"
                                    value={(getNestedValue(config, "ai.defaultModelName") as string) || ""}
                                    onChange={handleFieldChange}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">固定模型列表</label>
                                <StringArrayEditor
                                    description="固定模型列表"
                                    path="ai.pinnedModels"
                                    value={(getNestedValue(config, "ai.pinnedModels") as string[]) || []}
                                    onChange={handleFieldChange}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-md font-semibold mb-4">兴趣度评分配置</h4>
                        <div className="grid gap-4">
                            <div className="space-y-1">
                                <label className="text-sm font-medium">正向关键词</label>
                                <StringArrayEditor
                                    description="正向关键词"
                                    path="ai.interestScore.UserInterestsPositiveKeywords"
                                    value={(getNestedValue(config, "ai.interestScore.UserInterestsPositiveKeywords") as string[]) || []}
                                    onChange={handleFieldChange}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">负向关键词</label>
                                <StringArrayEditor
                                    description="负向关键词"
                                    path="ai.interestScore.UserInterestsNegativeKeywords"
                                    value={(getNestedValue(config, "ai.interestScore.UserInterestsNegativeKeywords") as string[]) || []}
                                    onChange={handleFieldChange}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-md font-semibold mb-4">向量嵌入配置</h4>
                        <div className="grid gap-4">
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Ollama Base URL</label>
                                <StringInput
                                    description="embedding 服务base地址，如 http://localhost:11434"
                                    error={getFieldError("ai.embedding.ollamaBaseURL")}
                                    path="ai.embedding.ollamaBaseURL"
                                    value={(getNestedValue(config, "ai.embedding.ollamaBaseURL") as string) || ""}
                                    onChange={handleFieldChange}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">嵌入模型名</label>
                                <StringInput
                                    description="嵌入模型名"
                                    error={getFieldError("ai.embedding.model")}
                                    path="ai.embedding.model"
                                    value={(getNestedValue(config, "ai.embedding.model") as string) || ""}
                                    onChange={handleFieldChange}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">批量处理大小</label>
                                <NumberInput
                                    description="批量处理大小"
                                    error={getFieldError("ai.embedding.batchSize")}
                                    min={1}
                                    path="ai.embedding.batchSize"
                                    value={(getNestedValue(config, "ai.embedding.batchSize") as number) || 0}
                                    onChange={handleFieldChange}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">向量数据库路径</label>
                                <StringInput
                                    description="向量数据库路径"
                                    error={getFieldError("ai.embedding.vectorDBPath")}
                                    path="ai.embedding.vectorDBPath"
                                    value={(getNestedValue(config, "ai.embedding.vectorDBPath") as string) || ""}
                                    onChange={handleFieldChange}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">向量维度</label>
                                <NumberInput
                                    description="向量维度"
                                    error={getFieldError("ai.embedding.dimension")}
                                    min={1}
                                    path="ai.embedding.dimension"
                                    value={(getNestedValue(config, "ai.embedding.dimension") as number) || 0}
                                    onChange={handleFieldChange}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-md font-semibold mb-4">RPC 服务配置</h4>
                        <div className="grid gap-4">
                            <div className="space-y-1">
                                <label className="text-sm font-medium">RPC 服务端口</label>
                                <NumberInput
                                    description="RPC 服务端口"
                                    error={getFieldError("ai.rpc.port")}
                                    max={65535}
                                    min={1}
                                    path="ai.rpc.port"
                                    value={(getNestedValue(config, "ai.rpc.port") as number) || 0}
                                    onChange={handleFieldChange}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            ),

            webUI_Backend: () => (
                <div className="space-y-6">
                    <div className="grid gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">后端服务端口</label>
                            <NumberInput
                                description="后端服务端口"
                                error={getFieldError("webUI_Backend.port")}
                                max={65535}
                                min={1}
                                path="webUI_Backend.port"
                                value={(getNestedValue(config, "webUI_Backend.port") as number) || 0}
                                onChange={handleFieldChange}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">KV 存储基础路径</label>
                            <StringInput
                                description="KV 存储基础路径"
                                error={getFieldError("webUI_Backend.kvStoreBasePath")}
                                path="webUI_Backend.kvStoreBasePath"
                                value={(getNestedValue(config, "webUI_Backend.kvStoreBasePath") as string) || ""}
                                onChange={handleFieldChange}
                            />
                        </div>
                    </div>
                </div>
            ),

            orchestrator: () => (
                <div className="space-y-6">
                    <div className="grid gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Pipeline 执行间隔（分钟）</label>
                            <NumberInput
                                description="Pipeline 执行间隔（分钟）"
                                error={getFieldError("orchestrator.pipelineIntervalInMinutes")}
                                min={1}
                                path="orchestrator.pipelineIntervalInMinutes"
                                value={(getNestedValue(config, "orchestrator.pipelineIntervalInMinutes") as number) || 0}
                                onChange={handleFieldChange}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">数据时间窗口（小时）</label>
                            <NumberInput
                                description="数据时间窗口（小时）"
                                error={getFieldError("orchestrator.dataSeekTimeWindowInHours")}
                                min={1}
                                path="orchestrator.dataSeekTimeWindowInHours"
                                value={(getNestedValue(config, "orchestrator.dataSeekTimeWindowInHours") as number) || 0}
                                onChange={handleFieldChange}
                            />
                        </div>
                    </div>
                </div>
            ),

            webUI_Forwarder: () => (
                <div className="space-y-6">
                    <div className="grid gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">启用内网穿透</label>
                            <BooleanSwitch
                                description="是否启用内网穿透"
                                path="webUI_Forwarder.enabled"
                                value={(getNestedValue(config, "webUI_Forwarder.enabled") as boolean) || false}
                                onChange={handleFieldChange}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">前端 ngrok Token</label>
                            <StringInput
                                description="前端 ngrok Token（可选）"
                                error={getFieldError("webUI_Forwarder.authTokenForFE")}
                                path="webUI_Forwarder.authTokenForFE"
                                value={(getNestedValue(config, "webUI_Forwarder.authTokenForFE") as string) || ""}
                                onChange={handleFieldChange}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">后端 ngrok Token</label>
                            <StringInput
                                description="后端 ngrok Token（可选）"
                                error={getFieldError("webUI_Forwarder.authTokenForBE")}
                                path="webUI_Forwarder.authTokenForBE"
                                value={(getNestedValue(config, "webUI_Forwarder.authTokenForBE") as string) || ""}
                                onChange={handleFieldChange}
                            />
                        </div>
                    </div>
                </div>
            ),

            commonDatabase: () => (
                <div className="space-y-6">
                    <div className="grid gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">数据库基础路径</label>
                            <StringInput
                                description="数据库基础路径"
                                error={getFieldError("commonDatabase.dbBasePath")}
                                path="commonDatabase.dbBasePath"
                                value={(getNestedValue(config, "commonDatabase.dbBasePath") as string) || ""}
                                onChange={handleFieldChange}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">最大数据库持续时间（天）</label>
                            <NumberInput
                                description="最大数据库持续时间（天）"
                                error={getFieldError("commonDatabase.maxDBDuration")}
                                min={1}
                                path="commonDatabase.maxDBDuration"
                                value={(getNestedValue(config, "commonDatabase.maxDBDuration") as number) || 0}
                                onChange={handleFieldChange}
                            />
                        </div>
                    </div>
                </div>
            ),

            logger: () => (
                <div className="space-y-6">
                    <div className="grid gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">日志级别</label>
                            <EnumSelect
                                description="日志级别"
                                error={getFieldError("logger.logLevel")}
                                options={["debug", "info", "success", "warning", "error"]}
                                path="logger.logLevel"
                                value={(getNestedValue(config, "logger.logLevel") as string) || "info"}
                                onChange={handleFieldChange}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">日志目录</label>
                            <StringInput
                                description="日志目录"
                                error={getFieldError("logger.logDirectory")}
                                path="logger.logDirectory"
                                value={(getNestedValue(config, "logger.logDirectory") as string) || ""}
                                onChange={handleFieldChange}
                            />
                        </div>
                    </div>
                </div>
            ),

            groupConfigs: () => (
                <div className="space-y-6">
                    <RecordEditor
                        errors={errors}
                        itemSchema="GroupConfig"
                        path="groupConfigs"
                        value={(getNestedValue(config, "groupConfigs") as Record<string, unknown>) || {}}
                        onChange={handleFieldChange}
                        onFieldChange={handleFieldChange}
                    />
                </div>
            )
        };

        return sectionRenderers;
    }, [config, errors, handleFieldChange, getFieldError]);

    if (isLoading) {
        return (
            <DefaultLayout>
                <div className="flex justify-center items-center h-[60vh]">
                    <Spinner label="加载配置中..." size="lg" />
                </div>
            </DefaultLayout>
        );
    }

    return (
        <DefaultLayout>
            <section className="flex flex-col gap-4 py-8 md:py-10">
                <div className="flex flex-col items-center justify-center gap-4">
                    <h1 className={title()}>配置面板</h1>
                    <p className="text-default-600 max-w-2xl text-center">可视化编辑系统配置，所有更改将保存到 override 配置文件</p>
                </div>

                {/* 操作栏 */}
                <div className="flex justify-center gap-4 mt-4">
                    <Button color="primary" isDisabled={errors.length > 0} isLoading={isSaving} startContent={!isSaving && <Save className="w-4 h-4" />} onPress={handleSave}>
                        保存配置
                    </Button>
                    <Button startContent={<RotateCcw className="w-4 h-4" />} variant="flat" onPress={handleReset}>
                        重置
                    </Button>
                    {saveStatus === "success" && (
                        <Chip color="success" startContent={<CheckCircle className="w-4 h-4" />}>
                            保存成功
                        </Chip>
                    )}
                    {errors.length > 0 && (
                        <Chip color="danger" startContent={<AlertCircle className="w-4 h-4" />}>
                            {errors.length} 个错误
                        </Chip>
                    )}
                </div>

                {/* 主内容区 */}
                <div className="flex gap-6 mt-6">
                    {/* 侧边栏导航 */}
                    <Card className="w-64 h-fit sticky top-20">
                        <CardBody className="p-2">
                            <ScrollShadow className="max-h-[70vh]">
                                <nav className="space-y-1">
                                    {CONFIG_SECTIONS.map(section => (
                                        <button
                                            key={section.key}
                                            className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                                                activeSection === section.key ? "bg-primary text-primary-foreground" : "hover:bg-default-100"
                                            }`}
                                            onClick={() => scrollToSection(section.key)}
                                        >
                                            <span className="mr-2">{section.icon}</span>
                                            {section.label}
                                        </button>
                                    ))}
                                </nav>
                            </ScrollShadow>
                        </CardBody>
                    </Card>

                    {/* 配置表单 */}
                    <div className="flex-1 space-y-6">
                        {CONFIG_SECTIONS.map(section => (
                            <Card key={section.key} className="p-3" id={`section-${section.key}`}>
                                <CardHeader>
                                    <h3 className="text-lg font-bold">
                                        <span className="mr-2">{section.icon}</span>
                                        {section.label}
                                    </h3>
                                </CardHeader>
                                <CardBody>{renderSection[section.key]?.()}</CardBody>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>
        </DefaultLayout>
    );
}
