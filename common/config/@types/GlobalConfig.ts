interface ModelConfig {
    apiKey: string;
    baseURL: string;
    temperature: number;
    maxTokens: number;
}

interface GroupConfig {
    IM: "QQ" | "WeChat";
    splitStrategy: "realtime" | "accumulative"; // 消息分割策略
    groupIntroduction: string; // 群简介，用于拼接在context里面
    aiModels: string[]; // 要使用的AI模型名。必须在ai.models里面有对应的配置。使用的时候会从第一个开始尝试，如果失败了就会尝试下一个。
}

export interface UserInterest {
    keyword: string;
    liked: boolean;
}

// 若无特殊说明，所有设置项都是必填的
export interface GlobalConfig {
    // 各层配置
    dataProviders: {
        QQ: {
            VFSExtPath: string; // sqlite vfs扩展路径
            dbBasePath: string; // NTQQ存放数据库的文件夹路径（不是某个数据库文件的路径）
            dbKey: string; // NTQQ的数据库密钥
            dbPatch: {
                enabled: boolean; // 是否启用数据库补丁
                patchSQL?: string; // 数据库补丁的SQL语句，选填
            };
        };
    };
    preprocessors: {
        AccumulativeSplitter: {
            mode: "charCount" | "messageCount"; // 分割模式
            maxCharCount: number; // 最大字符数
            maxMessageCount: number; // 最大消息数
            persistentKVStorePath: string; // 持久化KVStore路径（用于存储sessionId的使用量）
        };
        TimeoutSplitter: {
            timeoutInMinutes: number; // 超时时间，单位为分钟
        };
    };
    ai: {
        // 模型配置，key为模型名称，value为模型的具体配置
        models: Record<string, ModelConfig>;
        defaultModelConfig: ModelConfig;
        defaultModelName: string;
        pinnedModels: string[]; // 固定的模型列表，优先级最高，会最先尝试
        // 兴趣度指数打分任务的配置
        interestScore: {
            UserInterestsPositiveKeywords: string[]; // 正向关键词
            UserInterestsNegativeKeywords: string[]; // 负向关键词
        };
        // 向量嵌入任务的配置
        embedding: {
            ollamaBaseURL: string; // Ollama 服务地址，如 "http://localhost:11434"
            model: string; // 嵌入模型名，如 "bge-m3"
            batchSize: number; // 批量处理大小
            vectorDBPath: string; // 向量数据库文件路径
            dimension: number; // 向量维度，bge-m3 为 1024
        };
        // RPC 服务配置
        rpc: {
            port: number; // RPC 服务端口，默认 7979
        };
    };
    webUI_Backend: {
        port: number;
        kvStoreBasePath: string;
    };
    // Pipeline 调度器配置
    orchestrator: {
        pipelineIntervalInMinutes: number; // Pipeline 执行间隔，单位为分钟
        dataSeekTimeWindowInHours: number; // 数据获取任务的数据时间窗口，单位为小时
    };
    // 内网穿透服务配置（使用ngrok将webUI前后端暴露到公网）
    webUI_Forwarder: {
        enabled: boolean;
        authTokenForFE?: string;
        authTokenForBE?: string;
    };

    // 共享配置
    commonDatabase: {
        dbBasePath: string;
        maxDBDuration: number; // 最大数据库持续时间（天），超过这个时间就会把写入请求路由到新库
    };
    logger: {
        logLevel: "debug" | "info" | "success" | "warning" | "error"; // 级别大于等于这个级别的日志才会被输出
        logDirectory: string; // 日志目录
    };
    groupConfigs: Record<string, GroupConfig>; // 群号到群配置的映射
}
