/**
 * 共享的依赖注入 Token 定义
 * 所有 app 共用这些 Token 以确保依赖标识的一致性
 */

export const COMMON_TOKENS = {
    // 配置服务
    ConfigManagerService: Symbol.for("ConfigManagerService"),

    // 数据库管理器
    AgcDbAccessService: Symbol.for("AgcDbAccessService"),
    ImDbAccessService: Symbol.for("ImDbAccessService"),
    InterestScoreDbAccessService: Symbol.for("InterestScoreDbAccessService"),

    // 邮件服务
    EmailService: Symbol.for("EmailService")
} as const;
