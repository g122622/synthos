/**
 * 任务注册表 API 服务
 */

import type { TaskRegistryResponse } from "../types/taskRegistry";

const API_BASE = "/api/tasks";

/**
 * 获取任务注册表（所有已注册任务的元数据）
 */
export async function fetchTaskRegistry(): Promise<TaskRegistryResponse> {
    const response = await fetch(`${API_BASE}/registry`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        throw new Error(`获取任务注册表失败: ${response.statusText}`);
    }

    return response.json();
}
