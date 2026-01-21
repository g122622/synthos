/**
 * Agent 初始化模块
 * 负责注册所有工具到 ToolRegistry
 */
import { injectable, inject } from "tsyringe";
import { ToolRegistry } from "./ToolRegistry";
import { RagSearchTool } from "./tools/RagSearchTool";
import { SQLQueryTool } from "./tools/SQLQueryTool";
import { WebSearchTool } from "./tools/WebSearchTool";
import { VarSetTool } from "./tools/VarSetTool";
import { VarGetTool } from "./tools/VarGetTool";
import { VarListTool } from "./tools/VarListTool";
import { VarDeleteTool } from "./tools/VarDeleteTool";
import { DeepResearchTool } from "./tools/DeepResearchTool";
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
        @inject(AI_MODEL_TOKENS.WebSearchTool) private webSearchTool: WebSearchTool,
        @inject(AI_MODEL_TOKENS.VarSetTool) private varSetTool: VarSetTool,
        @inject(AI_MODEL_TOKENS.VarGetTool) private varGetTool: VarGetTool,
        @inject(AI_MODEL_TOKENS.VarListTool) private varListTool: VarListTool,
        @inject(AI_MODEL_TOKENS.VarDeleteTool) private varDeleteTool: VarDeleteTool,
        @inject(AI_MODEL_TOKENS.DeepResearchTool) private deepResearchTool: DeepResearchTool
    ) {}

    /**
     * 初始化 Agent 系统，注册所有工具
     */
    public async init(): Promise<void> {
        if (this.isInitialized) {
            this.LOGGER.warning("Agent 系统已初始化，跳过重复初始化");
            return;
        }

        this.LOGGER.debug("开始初始化 Agent 系统...");
        this.LOGGER.debug(`ToolRegistry 实例: ${this.toolRegistry ? "已注入" : "未注入"}`);
        this.LOGGER.debug(`RagSearchTool 实例: ${this.ragSearchTool ? "已注入" : "未注入"}`);
        this.LOGGER.debug(`SQLQueryTool 实例: ${this.sqlQueryTool ? "已注入" : "未注入"}`);
        this.LOGGER.debug(`WebSearchTool 实例: ${this.webSearchTool ? "已注入" : "未注入"}`);
        this.LOGGER.debug(`VarSetTool 实例: ${this.varSetTool ? "已注入" : "未注入"}`);
        this.LOGGER.debug(`VarGetTool 实例: ${this.varGetTool ? "已注入" : "未注入"}`);
        this.LOGGER.debug(`VarListTool 实例: ${this.varListTool ? "已注入" : "未注入"}`);
        this.LOGGER.debug(`VarDeleteTool 实例: ${this.varDeleteTool ? "已注入" : "未注入"}`);
        this.LOGGER.debug(`DeepResearchTool 实例: ${this.deepResearchTool ? "已注入" : "未注入"}`);

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

        // 注册变量空间工具（CAVM：统一可编程变量空间）
        this.toolRegistry.registerTool(this.varSetTool.getDefinition(), this.varSetTool.getExecutor() as any);
        this.toolRegistry.registerTool(this.varGetTool.getDefinition(), this.varGetTool.getExecutor() as any);
        this.toolRegistry.registerTool(this.varListTool.getDefinition(), this.varListTool.getExecutor() as any);
        this.toolRegistry.registerTool(
            this.varDeleteTool.getDefinition(),
            this.varDeleteTool.getExecutor() as any
        );

        // 注册深度研究工具（Planner 拆解 + 并行分析，CoA 写入变量空间）
        this.toolRegistry.registerTool(
            this.deepResearchTool.getDefinition(),
            this.deepResearchTool.getExecutor() as any
        );

        this.isInitialized = true;
        this.LOGGER.success(`Agent 系统初始化完成，共注册 ${this.toolRegistry.getToolCount()} 个工具`);
    }
}
