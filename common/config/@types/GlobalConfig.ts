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
}
