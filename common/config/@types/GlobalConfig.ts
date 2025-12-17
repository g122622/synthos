import { z } from "zod";

// ==================== Zod Schema 定义（用于运行时验证）====================

/**
 * AI 模型配置 Schema
 */
export const ModelConfigSchema = z.object({
    apiKey: z.string().describe("API 密钥"),
    baseURL: z.string().url().describe("API 基础 URL"),
    temperature: z.number().min(0).max(2).describe("温度参数，控制输出的随机性"),
    maxTokens: z.number().positive().int().describe("最大 Token 数量"),
});

/**
 * 群组配置 Schema
 */
export const GroupConfigSchema = z.object({
    IM: z.enum(["QQ", "WeChat"]).describe("IM 平台类型"),
    splitStrategy: z.enum(["realtime", "accumulative"]).describe("消息分割策略"),
    groupIntroduction: z.string().describe("群简介，用于拼接在 context 里面"),
    aiModels: z.array(z.string()).describe("要使用的 AI 模型名列表，按优先级排序"),
});

/**
 * 用户兴趣配置 Schema
 */
export const UserInterestSchema = z.object({
    keyword: z.string().describe("关键词"),
    liked: z.boolean().describe("是否喜欢"),
});

/**
 * 全局配置 Schema
 */
export const GlobalConfigSchema = z.object({
    dataProviders: z.object({
        QQ: z.object({
            VFSExtPath: z.string().describe("sqlite vfs 扩展路径"),
            dbBasePath: z.string().describe("NTQQ 存放数据库的文件夹路径"),
            dbKey: z.string().describe("NTQQ 的数据库密钥"),
            dbPatch: z.object({
                enabled: z.boolean().describe("是否启用数据库补丁"),
                patchSQL: z.string().optional().describe("数据库补丁的 SQL 语句"),
            }).describe("数据库补丁配置"),
        }).describe("QQ 数据源配置"),
    }).describe("dataProviders配置"),

    preprocessors: z.object({
        AccumulativeSplitter: z.object({
            mode: z.enum(["charCount", "messageCount"]).describe("分割模式"),
            maxCharCount: z.number().positive().int().describe("最大字符数"),
            maxMessageCount: z.number().positive().int().describe("最大消息数"),
            persistentKVStorePath: z.string().describe("持久化 KVStore 路径"),
        }).describe("累积分割器配置"),
        TimeoutSplitter: z.object({
            timeoutInMinutes: z.number().positive().int().describe("超时时间（分钟）"),
        }).describe("超时分割器配置"),
    }).describe("预处理器配置"),

    ai: z.object({
        models: z.record(z.string(), ModelConfigSchema).describe("模型配置映射"),
        defaultModelConfig: ModelConfigSchema.describe("默认模型配置"),
        defaultModelName: z.string().describe("默认模型名称"),
        pinnedModels: z.array(z.string()).describe("固定模型列表"),
        interestScore: z.object({
            UserInterestsPositiveKeywords: z.array(z.string()).describe("正向关键词"),
            UserInterestsNegativeKeywords: z.array(z.string()).describe("负向关键词"),
        }).describe("兴趣度评分配置"),
        embedding: z.object({
            ollamaBaseURL: z.string().describe("embedding 服务base地址，如 http://localhost:11434"),
            model: z.string().describe("嵌入模型名"),
            batchSize: z.number().positive().int().describe("批量处理大小"),
            vectorDBPath: z.string().describe("向量数据库路径"),
            dimension: z.number().positive().int().describe("向量维度"),
        }).describe("向量嵌入配置"),
        rpc: z.object({
            port: z.number().int().positive().int().describe("RPC 服务端口"),
        }).describe("RPC 服务配置"),
    }).describe("AI 配置"),

    webUI_Backend: z.object({
        port: z.number().int().positive().describe("后端服务端口"),
        kvStoreBasePath: z.string().describe("KV 存储基础路径"),
        dbBasePath: z.string().describe("数据库基础路径"),
    }).describe("WebUI 后端配置"),

    orchestrator: z.object({
        pipelineIntervalInMinutes: z.number().positive().int().describe("Pipeline 执行间隔（分钟）"),
        dataSeekTimeWindowInHours: z.number().positive().int().describe("数据时间窗口（小时）"),
    }).describe("调度器配置"),

    webUI_Forwarder: z.object({
        enabled: z.boolean().describe("是否启用内网穿透"),
        authTokenForFE: z.string().optional().describe("前端 ngrok Token"),
        authTokenForBE: z.string().optional().describe("后端 ngrok Token"),
    }).describe("内网穿透配置"),

    commonDatabase: z.object({
        dbBasePath: z.string().describe("数据库基础路径"),
        maxDBDuration: z.number().positive().int().describe("最大数据库持续时间（天）"),
    }).describe("公共数据库配置"),

    logger: z.object({
        logLevel: z.enum(["debug", "info", "success", "warning", "error"]).describe("日志级别"),
        logDirectory: z.string().describe("日志目录"),
    }).describe("日志配置"),

    groupConfigs: z.record(z.string(), GroupConfigSchema).describe("群配置映射"),
});

/**
 * 部分配置 Schema（用于 override 配置验证）
 */
export const PartialGlobalConfigSchema = GlobalConfigSchema.deepPartial();

// ==================== TypeScript 类型（从 Zod Schema 自动推导）====================

/**
 * 从 Zod Schema 生成严格类型（移除所有可选标记）
 */
type DeepRequired<T> = {
  [K in keyof T]-?: T[K] extends object | undefined
    ? T[K] extends (...args: any[]) => any
      ? T[K]
      : DeepRequired<NonNullable<T[K]>>
    : T[K];
};

/**
 * AI 模型配置类型
 */
export type ModelConfig = DeepRequired<z.infer<typeof ModelConfigSchema>>;

/**
 * 群组配置类型
 */
export type GroupConfig = DeepRequired<z.infer<typeof GroupConfigSchema>>;

/**
 * 用户兴趣配置类型
 */
export type UserInterest = DeepRequired<z.infer<typeof UserInterestSchema>>;

/**
 * 全局配置类型
 */
export type GlobalConfig = DeepRequired<z.infer<typeof GlobalConfigSchema>>;

/**
 * 部分配置类型（用于 override 配置）
 */
export type PartialGlobalConfig = z.infer<typeof PartialGlobalConfigSchema>;
