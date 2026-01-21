/**
 * ai-model 子项目的依赖注入 Token 定义
 * 用于标识子项目特有的服务
 */

export const AI_MODEL_TOKENS = {
    // ai-model 特有的服务
    /** 日报邮件服务 */
    ReportEmailService: Symbol.for("ReportEmailService"),
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
    /** Agent 执行器 */
    AgentExecutor: Symbol.for("AgentExecutor"),
    /** 工具注册表 */
    ToolRegistry: Symbol.for("ToolRegistry"),
    /** RAG 搜索工具 */
    RagSearchTool: Symbol.for("RagSearchTool"),
    /** SQL 查询工具 */
    SQLQueryTool: Symbol.for("SQLQueryTool"),
    /** Web 搜索工具 */
    WebSearchTool: Symbol.for("WebSearchTool"),
    /** Agent 初始化器 */
    AgentInitializer: Symbol.for("AgentInitializer"),

    // Agent 变量空间
    /** 变量空间服务 */
    VariableSpaceService: Symbol.for("VariableSpaceService"),
    /** var_set 工具 */
    VarSetTool: Symbol.for("VarSetTool"),
    /** var_get 工具 */
    VarGetTool: Symbol.for("VarGetTool"),
    /** var_list 工具 */
    VarListTool: Symbol.for("VarListTool"),
    /** var_delete 工具 */
    VarDeleteTool: Symbol.for("VarDeleteTool"),

    // 深度研究（Planner + 并行分析）
    /** 深度研究编排器 */
    DeepResearchOrchestrator: Symbol.for("DeepResearchOrchestrator"),
    /** 深度研究工具 */
    DeepResearchTool: Symbol.for("DeepResearchTool"),

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
