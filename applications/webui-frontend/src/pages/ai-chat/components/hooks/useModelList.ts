/**
 * 获取可用 AI 模型列表的 Hook
 * 从配置 API 获取 ai.models 键列表和默认模型名称
 */
import { useState, useEffect } from "react";

import { getCurrentConfig } from "@/api/configApi";

export interface ModelListResult {
    /** 可用模型名称列表（按 pinned 优先、字母排序） */
    models: string[];
    /** 配置中的默认模型名称 */
    defaultModelName: string;
    /** 是否正在加载 */
    loading: boolean;
}

/**
 * 从全局配置中获取可用 AI 模型列表
 */
export function useModelList(): ModelListResult {
    const [models, setModels] = useState<string[]>([]);
    const [defaultModelName, setDefaultModelName] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const response = await getCurrentConfig();

                if (!cancelled && response.success && response.data) {
                    const config = response.data as Record<string, unknown>;
                    const ai = (config.ai || {}) as Record<string, unknown>;
                    const modelMap = (ai.models || {}) as Record<string, unknown>;
                    const pinned = (ai.pinnedModels || []) as string[];
                    const defaultName = (ai.defaultModelName || "") as string;

                    const modelNames = Object.keys(modelMap);

                    // 排序：pinned 模型优先，其余按字母排序
                    const sorted = modelNames.sort((a, b) => {
                        const aPinned = pinned.includes(a) ? 0 : 1;
                        const bPinned = pinned.includes(b) ? 0 : 1;

                        if (aPinned !== bPinned) {
                            return aPinned - bPinned;
                        }

                        return a.localeCompare(b);
                    });

                    setModels(sorted);
                    setDefaultModelName(defaultName);
                }
            } catch (error) {
                console.error("获取模型列表失败:", error);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    return { models, defaultModelName, loading };
}
