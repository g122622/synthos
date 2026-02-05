/**
 * Agent 工具目录
 * 统一管理 Agent 可用工具的定义与执行器，并支持按 enabledTools 过滤。
 */
import "reflect-metadata";
import type { ToolDefinition, ToolContext } from "../agent/contracts/index";

import { injectable, inject } from "tsyringe";
import Logger from "@root/common/util/Logger";

import { AI_MODEL_TOKENS } from "../di/tokens";
import { RagSearchTool } from "../agent/tools/RagSearchTool";
import { SQLQueryTool } from "../agent/tools/SQLQueryTool";
import { WebSearchTool } from "../agent/tools/WebSearchTool";

export type AgentToolName = "rag_search" | "sql_query" | "web_search";

@injectable()
export class AgentToolCatalog {
    private LOGGER = Logger.withTag("AgentToolCatalog");

    private readonly toolDefinitions: Map<AgentToolName, ToolDefinition>;
    private readonly toolExecutors: Map<AgentToolName, (params: any, context: ToolContext) => Promise<unknown>>;

    public constructor(
        @inject(AI_MODEL_TOKENS.RagSearchTool) private ragSearchTool: RagSearchTool,
        @inject(AI_MODEL_TOKENS.SQLQueryTool) private sqlQueryTool: SQLQueryTool,
        @inject(AI_MODEL_TOKENS.WebSearchTool) private webSearchTool: WebSearchTool
    ) {
        const ragDef = this.ragSearchTool.getDefinition();
        const sqlDef = this.sqlQueryTool.getDefinition();
        const webDef = this.webSearchTool.getDefinition();

        this.toolDefinitions = new Map<AgentToolName, ToolDefinition>([
            ["rag_search", ragDef],
            ["sql_query", sqlDef],
            ["web_search", webDef]
        ]);

        this.toolExecutors = new Map<AgentToolName, (params: any, context: ToolContext) => Promise<unknown>>([
            ["rag_search", this.ragSearchTool.getExecutor() as any],
            ["sql_query", this.sqlQueryTool.getExecutor() as any],
            ["web_search", this.webSearchTool.getExecutor() as any]
        ]);

        this.LOGGER.debug(`初始化完成，工具数量: ${this.toolDefinitions.size}`);
    }

    public getAllToolNames(): AgentToolName[] {
        return Array.from(this.toolDefinitions.keys());
    }

    public getAllToolDefinitions(): ToolDefinition[] {
        return this.getAllToolNames().map(name => this.toolDefinitions.get(name)!);
    }

    public getToolDefinition(toolName: AgentToolName): ToolDefinition {
        const def = this.toolDefinitions.get(toolName);

        if (!def) {
            throw new Error(`未找到工具定义: ${toolName}`);
        }

        return def;
    }

    public isToolEnabled(toolName: string, enabledTools: string[] | undefined): toolName is AgentToolName {
        if (!enabledTools || enabledTools.length === 0) {
            return false;
        }

        return enabledTools.includes(toolName) && this.toolDefinitions.has(toolName as AgentToolName);
    }

    public getEnabledToolDefinitions(enabledTools: string[] | undefined): ToolDefinition[] {
        if (!enabledTools || enabledTools.length === 0) {
            return [];
        }

        const enabled: ToolDefinition[] = [];

        for (const name of this.getAllToolNames()) {
            if (enabledTools.includes(name)) {
                enabled.push(this.toolDefinitions.get(name)!);
            }
        }

        return enabled;
    }

    public async executeTool(
        toolName: string,
        params: Record<string, unknown>,
        context: ToolContext,
        enabledTools: string[] | undefined
    ): Promise<unknown> {
        if (!this.isToolEnabled(toolName, enabledTools)) {
            throw new Error(`工具未启用: ${toolName}`);
        }

        const executor = this.toolExecutors.get(toolName);

        if (!executor) {
            throw new Error(`未找到工具执行器: ${toolName}`);
        }

        return executor(params, context);
    }
}
