/**
 * 配置面板页面
 * 支持可视化编辑全局配置
 */
import type { ValidationError } from "./types";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Spinner } from "@heroui/spinner";
import { Chip } from "@heroui/chip";
import { Save, RotateCcw, AlertCircle, CheckCircle } from "lucide-react";

import { CONFIG_SECTIONS } from "./constants";
import { setNestedValue } from "./utils";
import {
    ConfigSidebar,
    DataProvidersSection,
    PreprocessorsSection,
    AISection,
    WebUIBackendSection,
    OrchestratorSection,
    WebUIForwarderSection,
    CommonDatabaseSection,
    LoggerSection,
    GroupConfigsSection
} from "./components";

import { getCurrentConfig, saveOverrideConfig, validateConfig } from "@/api/configApi";
import { title } from "@/components/primitives";
import DefaultLayout from "@/layouts/default";

// ==================== Section 渲染器映射 ====================

const SECTION_COMPONENTS: Record<
    string,
    React.FC<{
        config: Record<string, unknown>;
        errors: ValidationError[];
        onFieldChange: (path: string, value: unknown) => void;
    }>
> = {
    dataProviders: DataProvidersSection,
    preprocessors: PreprocessorsSection,
    ai: AISection,
    webUI_Backend: WebUIBackendSection,
    orchestrator: OrchestratorSection,
    webUI_Forwarder: WebUIForwarderSection,
    commonDatabase: CommonDatabaseSection,
    logger: LoggerSection,
    groupConfigs: GroupConfigsSection
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
        return CONFIG_SECTIONS.map(section => {
            const SectionComponent = SECTION_COMPONENTS[section.key];

            if (!SectionComponent) return null;

            return (
                <Card key={section.key} className="p-3" id={`section-${section.key}`}>
                    <CardHeader>
                        <h3 className="text-lg font-bold">
                            <span className="mr-2">{section.icon}</span>
                            {section.label}
                        </h3>
                    </CardHeader>
                    <CardBody>
                        <SectionComponent config={config} errors={errors} onFieldChange={handleFieldChange} />
                    </CardBody>
                </Card>
            );
        });
    }, [config, errors, handleFieldChange]);

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
                    <ConfigSidebar activeSection={activeSection} sections={CONFIG_SECTIONS} onSectionClick={scrollToSection} />

                    {/* 配置表单 */}
                    <div className="flex-1 space-y-6">{renderSections}</div>
                </div>
            </section>
        </DefaultLayout>
    );
}
