/**
 * 配置侧边栏组件
 */
import type { ConfigSidebarProps } from "../types/index";

import React from "react";
import { Card, CardBody } from "@heroui/card";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Input } from "@heroui/input";
import { Search, X } from "lucide-react";

/**
 * 配置面板侧边栏
 * 包含搜索框和配置区域导航
 */
const ConfigSidebar: React.FC<ConfigSidebarProps> = ({ sections, activeSection, onSectionClick, searchQuery, onSearchQueryChange }) => {
    return (
        <Card className="w-64 h-fit sticky top-20">
            <CardBody className="p-4 space-y-4">
                {/* 搜索框 */}
                <Input
                    classNames={{
                        inputWrapper: "bg-default-100"
                    }}
                    endContent={
                        searchQuery ? (
                            <button className="focus:outline-none" type="button" onClick={() => onSearchQueryChange("")}>
                                <X className="w-4 h-4 text-default-400 hover:text-default-600" />
                            </button>
                        ) : null
                    }
                    placeholder="搜索配置项..."
                    size="sm"
                    startContent={<Search className="w-4 h-4 text-default-400" />}
                    value={searchQuery}
                    onChange={e => onSearchQueryChange(e.target.value)}
                />

                <ScrollShadow className="max-h-[65vh]">
                    <nav className="space-y-1">
                        {sections.map(section => (
                            <button
                                key={section.key}
                                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${activeSection === section.key ? "bg-primary text-primary-foreground" : "hover:bg-default-100"}`}
                                onClick={() => onSectionClick(section.key)}
                            >
                                <span className="mr-2">{section.icon}</span>
                                {section.label}
                            </button>
                        ))}
                    </nav>
                </ScrollShadow>
            </CardBody>
        </Card>
    );
};

export default ConfigSidebar;
