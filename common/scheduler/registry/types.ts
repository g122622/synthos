/**
 * 任务注册中心 - 类型定义
 *
 * 定义任务元数据、表单字段配置等核心类型
 */

import { z } from "zod";

import { GlobalConfig } from "../../services/config/schemas/GlobalConfig";
import { ExecutionContext } from "../helpers/ExecutionContext";

/**
 * 任务元数据定义
 */
export interface TaskMetadata<TParams = any> {
    /** 任务内部名称（唯一标识） */
    internalName: string;
    /** 任务显示名称 */
    displayName: string;
    /** 任务描述 */
    description?: string;
    /** 参数 Schema（Zod） */
    paramsSchema: z.ZodType<TParams>;
    /**
     * 默认参数生成函数
     * @param context 整条workflow的执行上下文（可能为 null，用于前端获取元数据时）
     * @param config 配置对象
     */
    generateDefaultParams?: (context: ExecutionContext, config: GlobalConfig) => Promise<Partial<TParams>>;
}

export interface TaskDispatchContext<TParams = any> {
    metadata: TaskMetadata<TParams>;
    params: TParams;
}

/**
 * 任务元数据（前端可序列化版本）
 * 用于通过 API 传递给前端
 */
export interface SerializableTaskMetadata {
    /** 任务内部名称（唯一标识） */
    internalName: string;
    /** 任务显示名称 */
    displayName: string;
    /** 任务描述 */
    description?: string;
    /** 参数 JSON Schema */
    paramsJsonSchema: any;
}
