/**
 * 配置面板常量定义
 */

import type { SectionConfig } from "../types";

/** 配置区域列表 */
export const CONFIG_SECTIONS: SectionConfig[] = [
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

/** 敏感字段路径列表 */
export const SENSITIVE_FIELDS = ["dataProviders.QQ.dbKey", "ai.models.*.apiKey", "ai.defaultModelConfig.apiKey", "webUI_Forwarder.authTokenForFE", "webUI_Forwarder.authTokenForBE"];
