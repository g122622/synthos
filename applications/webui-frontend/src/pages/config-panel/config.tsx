/**
 * 配置面板页面
 * 支持可视化编辑全局配置
 * 支持搜索过滤、高亮匹配、全局展开/折叠
 */
import type { JsonSchema } from "@/api/configApi";
import type { SectionConfig, SearchContext, ValidationError } from "./types/index";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Spinner } from "@heroui/spinner";
import { Chip } from "@heroui/chip";
import { Save, RotateCcw, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

import { DEFAULT_SECTION_ICON, PREFERRED_SECTION_ORDER, SECTION_ICON_MAP } from "./constants/index";
import { setNestedValue, collectAllExpandablePaths, getParentPaths, doesSchemaHaveMatchingFields } from "./utils/index";
import { ConfigSidebar, SchemaForm } from "./components/index";

import { getConfigSchema, getCurrentConfig, saveOverrideConfig, validateConfig } from "@/api/configApi";
import { title } from "@/components/primitives";
import DefaultLayout from "@/layouts/default";
import { Notification } from "@/util/Notification";

/**
 * 将后端返回的校验错误归一化为 { path, message } 结构。
 *
 * 兼容两种格式：
 * 1) string[]（common/config/ConfigManagerService 的默认输出）
 * 2) { path, message }[]（未来若后端升级）
 */
const normalizeValidationErrors = (rawErrors: unknown): ValidationError[] => {
    if (!Array.isArray(rawErrors)) {
        return [];
    }

    if (rawErrors.length === 0) {
        return [];
    }

    const first = rawErrors[0] as any;

    if (typeof first === "object" && first && typeof first.path === "string" && typeof first.message === "string") {
        return rawErrors as ValidationError[];
    }

    return (rawErrors as string[]).map(err => {
        const idx = err.indexOf(":");

        if (idx === -1) {
            return { path: "", message: err };
        }

        return {
            path: err.slice(0, idx).trim(),
            message: err.slice(idx + 1).trim()
        };
    });
};

/**
 * 将 schema.description 分割成更适合 UI 的 label。
 */
const getSectionLabel = (schema: JsonSchema | undefined, fallbackLabel: string): string => {
    const description = schema?.description?.trim();
    const titleText = schema?.title?.trim();

    if (titleText) {
        return titleText;
    }

    if (!description) {
        return fallbackLabel;
    }

    const candidates = ["，", "。", "\n"];
    let firstIndex = -1;

    for (const c of candidates) {
        const idx = description.indexOf(c);

        if (idx > 0) {
            if (firstIndex === -1 || idx < firstIndex) {
                firstIndex = idx;
            }
        }
    }

    if (firstIndex > 0 && firstIndex <= 20) {
        return description.slice(0, firstIndex).trim();
    }

    return description;
};

/**
 * 根据 schema 顶层 properties 动态生成侧边栏配置区域。
 */
const unwrapRootSchema = (schema: JsonSchema): JsonSchema => {
    if (schema.$ref && schema.definitions) {
        const prefix = "#/definitions/";

        if (schema.$ref.startsWith(prefix)) {
            const defName = schema.$ref.slice(prefix.length);
            const defSchema = schema.definitions[defName];

            if (defSchema) {
                return { ...defSchema, definitions: schema.definitions };
            }
        }
    }

    return schema;
};

const buildSectionsFromSchema = (schema: JsonSchema): SectionConfig[] => {
    const rootSchema = unwrapRootSchema(schema);
    const properties = rootSchema.properties || {};
    const allKeys = Object.keys(properties);

    const orderedKeys: string[] = [];

    for (const key of PREFERRED_SECTION_ORDER) {
        if (allKeys.includes(key)) {
            orderedKeys.push(key);
        }
    }

    const restKeys = allKeys
        .filter(key => {
            return !orderedKeys.includes(key);
        })
        .sort((a, b) => {
            return a.localeCompare(b);
        });

    const finalKeys = [...orderedKeys, ...restKeys];

    return finalKeys.map(key => {
        const sectionSchema = properties[key];

        return {
            key,
            label: getSectionLabel(sectionSchema, key),
            icon: SECTION_ICON_MAP[key] || DEFAULT_SECTION_ICON
        };
    });
};

export default function ConfigPage() {
    const [config, setConfig] = useState<Record<string, unknown>>({});
    const [schema, setSchema] = useState<JsonSchema | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [errors, setErrors] = useState<ValidationError[]>([]);
    const [, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

    const [activeSection, setActiveSection] = useState<string>("");
    const [isScrolling, setIsScrolling] = useState(false);

    // 搜索关键词
    const [searchQuery, setSearchQuery] = useState<string>("");
    // 当前展开的路径集合
    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

    const sections = useMemo(() => {
        if (!schema) {
            return [];
        }

        return buildSectionsFromSchema(schema);
    }, [schema]);

    // 过滤后的 sections（搜索时只显示有匹配结果的 sections）
    const filteredSections = useMemo(() => {
        if (!searchQuery.trim() || !schema) {
            return sections;
        }

        const rootSchema = unwrapRootSchema(schema);

        if (!rootSchema.properties) {
            return sections;
        }

        return sections.filter(section => {
            const sectionSchema = rootSchema.properties?.[section.key];

            if (!sectionSchema) {
                return false;
            }

            const sectionValue = config[section.key];

            return doesSchemaHaveMatchingFields(sectionSchema, section.key, sectionValue, searchQuery);
        });
    }, [config, schema, searchQuery, sections]);

    // 收集所有可展开的路径
    const allExpandablePaths = useMemo(() => {
        if (!schema) {
            return [];
        }

        const rootSchema = unwrapRootSchema(schema);

        if (!rootSchema.properties) {
            return [];
        }

        const paths: string[] = [];

        for (const [sectionKey, sectionSchema] of Object.entries(rootSchema.properties)) {
            const sectionValue = config[sectionKey];
            const childPaths = collectAllExpandablePaths(sectionSchema, sectionKey, sectionValue);

            paths.push(...childPaths);
        }

        return paths;
    }, [config, schema]);

    // 搜索上下文，传递给子组件
    const searchContext: SearchContext = useMemo(() => {
        return {
            query: searchQuery,
            expandedKeys,
            onExpandedKeysChange: setExpandedKeys
        };
    }, [searchQuery, expandedKeys]);

    /**
     * 全局展开所有折叠项
     */
    const handleExpandAll = useCallback(() => {
        setExpandedKeys(new Set(allExpandablePaths));
    }, [allExpandablePaths]);

    /**
     * 全局折叠所有折叠项
     */
    const handleCollapseAll = useCallback(() => {
        setExpandedKeys(new Set());
    }, []);

    /**
     * 搜索关键词变化时，自动展开匹配字段的父级
     */
    const handleSearchQueryChange = useCallback(
        (query: string) => {
            setSearchQuery(query);

            // 如果有搜索词，自动展开所有匹配路径的父级
            if (query.trim()) {
                const newExpandedKeys = new Set<string>();
                const lowerQuery = query.toLowerCase();

                for (const path of allExpandablePaths) {
                    // 如果路径包含搜索词，展开其所有父路径
                    if (path.toLowerCase().includes(lowerQuery)) {
                        const parentPaths = getParentPaths(path);

                        for (const p of parentPaths) {
                            newExpandedKeys.add(p);
                        }
                    }
                }

                setExpandedKeys(newExpandedKeys);
            }
        },
        [allExpandablePaths]
    );

    // 加载配置 + schema
    const loadAll = useCallback(async () => {
        setIsLoading(true);

        try {
            const [configResponse, schemaResponse] = await Promise.all([getCurrentConfig(), getConfigSchema()]);

            if (configResponse.success) {
                setConfig(configResponse.data);
            } else {
                console.error("获取配置失败:", configResponse.message);
            }

            if (schemaResponse.success) {
                setSchema(schemaResponse.data);
            } else {
                console.error("获取 Schema 失败:", schemaResponse.message);
            }
        } catch (error) {
            console.error("加载配置面板数据失败:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    // schema 加载完成后初始化 activeSection
    useEffect(() => {
        if (sections.length === 0) {
            return;
        }

        if (!activeSection) {
            setActiveSection(sections[0].key);

            return;
        }

        const exists = sections.some(s => {
            return s.key === activeSection;
        });

        if (!exists) {
            setActiveSection(sections[0].key);
        }
    }, [activeSection, sections]);

    // 监听滚动事件，自动更新 activeSection
    useEffect(() => {
        // 如果正在程序化滚动，不更新 activeSection
        if (isScrolling) {
            return;
        }

        const handleScroll = () => {
            const sectionElements = sections
                .map(section => {
                    return {
                        key: section.key,
                        element: document.getElementById(`section-${section.key}`)
                    };
                })
                .filter(item => {
                    return item.element !== null;
                });

            if (sectionElements.length === 0) {
                return;
            }

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
    }, [isScrolling, sections]);

    // 验证配置（防抖）
    const validateConfigDebounced = useCallback(async (newConfig: Record<string, unknown>) => {
        try {
            const response = await validateConfig(newConfig, false);

            if (response.success) {
                if (response.data.valid) {
                    setErrors([]);
                } else {
                    setErrors(normalizeValidationErrors(response.data.errors));
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
            Notification.error({ title: "保存失败", description: "配置存在错误，请先修复后再保存" });

            return;
        }

        setIsSaving(true);
        try {
            const response = await saveOverrideConfig(config);

            if (response.success) {
                setSaveStatus("success");
                Notification.success({ title: "保存成功", description: "配置已成功保存" });
                setTimeout(() => setSaveStatus("idle"), 3000);
            } else {
                setSaveStatus("error");
                Notification.error({ title: "保存失败", description: response.message });
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
            loadAll();
            setSaveStatus("idle");
        }
    };

    // 滚动到指定区域
    const scrollToSection = useCallback((sectionKey: string) => {
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
    }, []);

    // 渲染配置区域
    const renderSections = useMemo(() => {
        if (!schema) {
            return null;
        }

        const rootSchema = unwrapRootSchema(schema);

        if (!rootSchema.properties) {
            return null;
        }

        return filteredSections.map(section => {
            const sectionSchema = rootSchema.properties?.[section.key];

            if (!sectionSchema) {
                return null;
            }

            // 渲染 SchemaForm，如果搜索时没有匹配内容，SchemaForm 可能返回 null
            const formContent = (
                <SchemaForm errors={errors} path={section.key} rootValue={config[section.key]} schema={sectionSchema} searchContext={searchContext} onFieldChange={handleFieldChange} />
            );

            return (
                <Card key={section.key} className="p-4" id={`section-${section.key}`}>
                    <CardHeader>
                        <h3 className="text-lg font-bold">
                            <span className="mr-2">{section.icon}</span>
                            {section.label}
                        </h3>
                    </CardHeader>
                    <CardBody>{formContent}</CardBody>
                </Card>
            );
        });
    }, [config, errors, filteredSections, handleFieldChange, schema, searchContext]);

    if (isLoading) {
        return (
            <DefaultLayout>
                <div className="flex justify-center items-center h-[60vh]">
                    <Spinner label="加载配置中..." size="lg" />
                </div>
            </DefaultLayout>
        );
    }

    if (!schema) {
        return (
            <DefaultLayout>
                <div className="flex justify-center items-center h-[60vh]">
                    <p className="text-default-600">配置 Schema 加载失败，请检查后端服务是否正常启动。</p>
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
                    <Button startContent={<ChevronDown className="w-4 h-4" />} variant="flat" onPress={handleExpandAll}>
                        全部展开
                    </Button>
                    <Button startContent={<ChevronUp className="w-4 h-4" />} variant="flat" onPress={handleCollapseAll}>
                        全部折叠
                    </Button>
                    {errors.length > 0 && (
                        <Chip color="danger" startContent={<AlertCircle className="w-4 h-4" />}>
                            {errors.length} 个错误
                        </Chip>
                    )}
                </div>

                {/* 主内容区 */}
                <div className="flex gap-6 mt-6">
                    {/* 侧边栏导航 */}
                    <ConfigSidebar activeSection={activeSection} searchQuery={searchQuery} sections={filteredSections} onSearchQueryChange={handleSearchQueryChange} onSectionClick={scrollToSection} />

                    {/* 配置表单 */}
                    <div className="flex-1 space-y-6">{renderSections}</div>
                </div>
            </section>
        </DefaultLayout>
    );
}
