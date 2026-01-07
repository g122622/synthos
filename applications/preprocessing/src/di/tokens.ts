/**
 * preprocessing 子项目的依赖注入 Token 定义
 * 用于标识子项目特有的服务
 */
import { COMMON_TOKENS } from "@root/common/di/tokens";

// 导出共享 Token
export { COMMON_TOKENS };

export const PREPROCESSING_TOKENS = {
    // 引用共享的数据库服务 Token
    ImDbAccessService: COMMON_TOKENS.ImDbAccessService,
    ConfigManagerService: COMMON_TOKENS.ConfigManagerService,

    // preprocessing 特有的服务
    /** 预处理任务处理器 */
    PreprocessTaskHandler: Symbol.for("PreprocessTaskHandler"),
    /** 累积式消息分割器 */
    AccumulativeSplitter: Symbol.for("AccumulativeSplitter"),
    /** 超时式消息分割器 */
    TimeoutSplitter: Symbol.for("TimeoutSplitter")
} as const;
