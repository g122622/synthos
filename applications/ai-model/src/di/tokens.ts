/**
 * ai-model 子项目的依赖注入 Token 定义
 * 用于标识子项目特有的服务
 */

export const AI_MODEL_TOKENS = {
    /** 日报邮件服务 */
    ReportEmailService: Symbol.for("ReportEmailService")
} as const;
