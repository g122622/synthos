interface ModelConfig {
    apiKey: string;
    baseURL: string;
    temperature: number;
    maxTokens: number;
}

export interface GlobalConfig {
    dataProviders: {
        QQ: {
            dbBasePath: string; // NTQQ存放数据库的文件夹路径（不是某个数据库文件的路径）
            dbKey: string; // NTQQ的数据库密钥
            dbPatch: {
                enabled: boolean; // 是否启用数据库补丁
                patchSQL: string; // 数据库补丁的SQL语句
            };
        };
    };
    commonDatabase: {
        dbBasePath: string;
        maxDBDuration: number; // 最大数据库持续时间（天），超过这个时间就会把读写请求路由到新库
    };
    logger: {
        logLevel: "debug" | "info" | "success" | "warning" | "error";
    };
    ai: {
        // 模型配置，key为模型名称，value为模型的具体配置
        models: Record<string, ModelConfig>;
        defaultModelConfig: ModelConfig;
    };
}
