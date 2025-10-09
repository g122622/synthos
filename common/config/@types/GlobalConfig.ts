export interface GlobalConfig {
    dataProviders: {
        QQ: {
            dbBasePath: string; // NTQQ存放数据库的文件夹路径（不是某个数据库文件的路径）
            dbKey: string; // NTQQ的数据库密钥
            ramdiskPath: string; // 用于暂存ramdisk路径
        };
    };
}
