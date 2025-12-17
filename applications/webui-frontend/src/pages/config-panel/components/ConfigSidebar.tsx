/**
 * 配置侧边栏组件
 */
import type { ConfigSidebarProps } from "../types";

import React from "react";
import { Card, CardBody } from "@heroui/card";
import { ScrollShadow } from "@heroui/scroll-shadow";

const ConfigSidebar: React.FC<ConfigSidebarProps> = ({ sections, activeSection, onSectionClick }) => {
    return (
        <Card className="w-64 h-fit sticky top-20">
            <CardBody className="p-4">
                <ScrollShadow className="max-h-[70vh]">
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
