/**
 * ai-model 子项目的依赖注入 Token 定义
 * 用于标识子项目特有的服务
 */

export const AI_MODEL_TOKENS = {
    // ai-model 特有的服务
    /** 日报邮件服务 */
    ReportEmailService: Symbol.for("ReportEmailService"),
    /** 兴趣话题邮件服务 */
    InterestEmailService: Symbol.for("InterestEmailService"),
    /** 向量数据库管理器 */
    VectorDBManagerService: Symbol.for("VectorDBManagerService"),
    /** 向量嵌入服务 **/
    EmbeddingService: Symbol.for("EmbeddingService"),
    /** 文本生成器 */
    TextGeneratorService: Symbol.for("TextGeneratorService"),
    /** RAG 上下文构建器 */
    RAGCtxBuilder: Symbol.for("RAGCtxBuilder"),
    /** RAG RPC 实现 */
    RagRPCImpl: Symbol.for("RagRPCImpl"),

    // Agent 相关服务
    /** LangGraph Agent 执行器 */
    LangGraphAgentExecutor: Symbol.for("LangGraphAgentExecutor"),
    /** Agent 工具目录（用于 enabledTools 过滤） */
    AgentToolCatalog: Symbol.for("AgentToolCatalog"),
    /** LangGraph Checkpointer 服务（SQLite） */
    LangGraphCheckpointerService: Symbol.for("LangGraphCheckpointerService"),
    /** RAG 搜索工具 */
    RagSearchTool: Symbol.for("RagSearchTool"),
    /** SQL 查询工具 */
    SQLQueryTool: Symbol.for("SQLQueryTool"),
    /** Web 搜索工具 */
    WebSearchTool: Symbol.for("WebSearchTool"),

    // 任务处理器
    /** AI 摘要任务处理器 */
    AISummarizeTaskHandler: Symbol.for("AISummarizeTaskHandler"),
    /** 兴趣度评分任务处理器 */
    InterestScoreTaskHandler: Symbol.for("InterestScoreTaskHandler"),
    /** LLM兴趣评估与通知任务处理器 */
    LLMInterestEvaluationAndNotificationTaskHandler: Symbol.for("LLMInterestEvaluationAndNotificationTaskHandler"),
    /** 向量嵌入生成任务处理器 */
    GenerateEmbeddingTaskHandler: Symbol.for("GenerateEmbeddingTaskHandler"),
    /** 日报生成任务处理器 */
    GenerateReportTaskHandler: Symbol.for("GenerateReportTaskHandler")
} as const;
