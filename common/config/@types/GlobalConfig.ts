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
    aiModel: string | undefined; // 要使用的AI模型名。必须在ai.models里面有对应的配置
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
                patchSQL: string; // 数据库补丁的SQL语句
            };
        };
        agendaTaskIntervalInMinutes: number; // 任务执行间隔，单位为分钟
    };
    preprocessors: {
        agendaTaskIntervalInMinutes: number; // 任务执行间隔，单位为分钟
        AccumulativeSplitter: {
            mode: "charCount" | "messageCount"; // 分割模式
            maxCharCount: number; // 最大字符数
            maxMessageCount: number; // 最大消息数
            persistentKVStorePath: string; // 持久化KVStore路径（用于存储sessionId的使用量）
        };
        TimeoutSplitter: {
            timeoutInMinutes: number; // 超时时间，单位为分钟
        }
    };
    ai: {
        // 模型配置，key为模型名称，value为模型的具体配置
        models: Record<string, ModelConfig>;
        defaultModelConfig: ModelConfig;
        defaultModelName: string;
        // 总结任务的配置
        summarize: {
            agendaTaskIntervalInMinutes: number; // 任务执行间隔，单位为分钟
        };
    };

    // 共享配置
    commonDatabase: {
        dbBasePath: string;
        maxDBDuration: number; // 最大数据库持续时间（天），超过这个时间就会把读写请求路由到新库
    };
    logger: {
        logLevel: "debug" | "info" | "success" | "warning" | "error"; // 级别大于等于这个级别的日志才会被输出
    };
    groupConfigs: Record<string, GroupConfig>; // 群号到群配置的映射
}
