/**
 * ai-model 子项目的依赖注入 Token 定义
 * 用于标识子项目特有的服务
 */
import { COMMON_TOKENS } from "@root/common/di/tokens";

// 导出共享 Token
export { COMMON_TOKENS };

export const AI_MODEL_TOKENS = {
    // 引用共享的数据库服务 Token
    AgcDbAccessService: COMMON_TOKENS.AgcDbAccessService,
    ImDbAccessService: COMMON_TOKENS.ImDbAccessService,
    InterestScoreDbAccessService: COMMON_TOKENS.InterestScoreDbAccessService,
    ReportDbAccessService: COMMON_TOKENS.ReportDbAccessService,
    ConfigManagerService: COMMON_TOKENS.ConfigManagerService,
    EmailService: COMMON_TOKENS.EmailService,

    // ai-model 特有的服务
    /** 日报邮件服务 */
    ReportEmailService: Symbol.for("ReportEmailService"),
    /** 向量数据库管理器 */
    VectorDBManager: Symbol.for("VectorDBManager"),
    /** 文本生成器 */
    TextGenerator: Symbol.for("TextGenerator"),
    /** RAG 上下文构建器 */
    RAGCtxBuilder: Symbol.for("RAGCtxBuilder"),
    /** RAG RPC 实现 */
    RagRPCImpl: Symbol.for("RagRPCImpl"),

    // 任务处理器
    /** AI 摘要任务处理器 */
    AISummarizeTaskHandler: Symbol.for("AISummarizeTaskHandler"),
    /** 兴趣度评分任务处理器 */
    InterestScoreTaskHandler: Symbol.for("InterestScoreTaskHandler"),
    /** 向量嵌入生成任务处理器 */
    GenerateEmbeddingTaskHandler: Symbol.for("GenerateEmbeddingTaskHandler"),
    /** 日报生成任务处理器 */
    GenerateReportTaskHandler: Symbol.for("GenerateReportTaskHandler")
} as const;
