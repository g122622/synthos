/**
 * Agent 初始化模块
 * 负责注册所有工具到 ToolRegistry
 */
import { injectable, inject } from "tsyringe";
import { ToolRegistry } from "./ToolRegistry";
import { RagSearchTool } from "./tools/RagSearchTool";
import { SQLQueryTool } from "./tools/SQLQueryTool";
import { WebSearchTool } from "./tools/WebSearchTool";
import Logger from "@root/common/util/Logger";
import { AI_MODEL_TOKENS } from "../di/tokens";

@injectable()
export class AgentInitializer {
    private LOGGER = Logger.withTag("AgentInitializer");
    private isInitialized = false;

    public constructor(
        @inject(AI_MODEL_TOKENS.ToolRegistry) private toolRegistry: ToolRegistry,
        @inject(AI_MODEL_TOKENS.RagSearchTool) private ragSearchTool: RagSearchTool,
        @inject(AI_MODEL_TOKENS.SQLQueryTool) private sqlQueryTool: SQLQueryTool,
        @inject(AI_MODEL_TOKENS.WebSearchTool) private webSearchTool: WebSearchTool
    ) {}

    /**
     * 初始化 Agent 系统，注册所有工具
     */
    public async init(): Promise<void> {
        if (this.isInitialized) {
            this.LOGGER.warning("Agent 系统已初始化，跳过重复初始化");
            return;
        }

        this.LOGGER.info("开始初始化 Agent 系统...");
        this.LOGGER.info(`ToolRegistry 实例: ${this.toolRegistry ? "已注入" : "未注入"}`);
        this.LOGGER.info(`RagSearchTool 实例: ${this.ragSearchTool ? "已注入" : "未注入"}`);
        this.LOGGER.info(`SQLQueryTool 实例: ${this.sqlQueryTool ? "已注入" : "未注入"}`);
        this.LOGGER.info(`WebSearchTool 实例: ${this.webSearchTool ? "已注入" : "未注入"}`);

        // 注册所有工具
        this.toolRegistry.registerTool(
            this.ragSearchTool.getDefinition(),
            this.ragSearchTool.getExecutor() as any
        );
        this.toolRegistry.registerTool(this.sqlQueryTool.getDefinition(), this.sqlQueryTool.getExecutor() as any);
        this.toolRegistry.registerTool(
            this.webSearchTool.getDefinition(),
            this.webSearchTool.getExecutor() as any
        );

        this.isInitialized = true;
        this.LOGGER.success(`Agent 系统初始化完成，共注册 ${this.toolRegistry.getToolCount()} 个工具`);
    }
}
