/**
 * data-provider 子项目的依赖注入 Token 定义
 * 用于标识子项目特有的服务
 */
import { COMMON_TOKENS } from "@root/common/di/tokens";

// 导出共享 Token
export { COMMON_TOKENS };

export const DATA_PROVIDER_TOKENS = {
    // 引用共享的数据库服务 Token
    ImDbAccessService: COMMON_TOKENS.ImDbAccessService,
    ConfigManagerService: COMMON_TOKENS.ConfigManagerService,

    // data-provider 特有的服务
    /** 数据提供任务处理器 */
    ProvideDataTaskHandler: Symbol.for("ProvideDataTaskHandler")
} as const;
