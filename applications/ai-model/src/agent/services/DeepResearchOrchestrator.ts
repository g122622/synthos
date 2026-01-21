import "reflect-metadata";
import { inject, injectable } from "tsyringe";
import { SystemMessage, HumanMessage, BaseMessage } from "@langchain/core/messages";
import Logger from "@root/common/util/Logger";
import { AI_MODEL_TOKENS } from "../../di/tokens";
import { TextGeneratorService } from "../../services/generators/text/TextGeneratorService";
import { AgentExecutor } from "../AgentExecutor";
import type { ToolContext } from "../contracts/tools";
import { VariableSpaceService } from "./VariableSpaceService";

/**
 * Planner 生成的任务定义
 */
export interface DeepResearchTask {
    id: string;
    title: string;
    goal: string;
    suggestedTools: Array<"rag_search" | "sql_query" | "web_search">;
}

/**
 * Planner 输出结构
 */
export interface DeepResearchPlan {
    objective: string;
    tasks: DeepResearchTask[];
}

/**
 * CoA（Chain-of-Analysis）块：用于写入变量空间，供后续写作/汇总检索
 */
export interface CoABlock {
    id: string;
    title: string;
    goal: string;
    claims: Array<{ statement: string; confidence: "high" | "medium" | "low" }>;
    evidence: Array<{
        source: "rag_search" | "sql_query" | "web_search" | "llm";
        note: string;
        ref?: string;
    }>;
    limitations: string[];
    nextQuestions: string[];
}

export interface DeepResearchResult {
    plan: DeepResearchPlan;
    coaKeys: string[];
}

interface OrchestratorConfig {
    /** 并发度上限 */
    concurrency: number;
    /** 最多任务数 */
    maxTasks: number;
    /** 每个任务的工具轮数 */
    maxToolRoundsPerTask: number;
}

/**
 * 深度研究编排器：Planner 拆解 + 并行分析（CoA 写入变量空间）
 */
@injectable()
export class DeepResearchOrchestrator {
    private LOGGER = Logger.withTag("DeepResearchOrchestrator");

    public constructor(
        @inject(AI_MODEL_TOKENS.TextGeneratorService) private textGeneratorService: TextGeneratorService,
        @inject(AI_MODEL_TOKENS.AgentExecutor) private agentExecutor: AgentExecutor,
        @inject(AI_MODEL_TOKENS.VariableSpaceService) private variableSpaceService: VariableSpaceService
    ) {}

    /**
     * 执行深度研究
     */
    public async run(
        question: string,
        context: ToolContext,
        config: OrchestratorConfig
    ): Promise<DeepResearchResult> {
        if (!context.sessionId || context.sessionId.trim().length === 0) {
            throw new Error("缺少 sessionId，无法执行 deep_research（需要变量空间）");
        }

        const plan = await this._createPlan(question, context, config.maxTasks);
        await this.variableSpaceService.set(
            context.sessionId,
            "deep_research.plan",
            plan,
            `深度研究计划：${plan.tasks.length} 个任务`
        );

        const tasks = plan.tasks.slice(0, config.maxTasks);

        const coaBlocks = await this._runWithConcurrencyLimit(tasks, config.concurrency, async task => {
            const coa = await this._runAnalysisTask(question, task, context, config.maxToolRoundsPerTask);
            return coa;
        });

        const coaKeys: string[] = [];
        for (const block of coaBlocks) {
            const key = `deep_research.coa.${block.id}`;
            coaKeys.push(key);
            await this.variableSpaceService.set(context.sessionId, key, block, `CoA：${block.title}`);
        }

        await this.variableSpaceService.set(
            context.sessionId,
            "deep_research.coa_index",
            coaKeys,
            `CoA 索引：${coaKeys.length} 个块`
        );

        return {
            plan,
            coaKeys
        };
    }

    private async _createPlan(
        question: string,
        context: ToolContext,
        maxTasks: number
    ): Promise<DeepResearchPlan> {
        const systemPrompt =
            "你是一个严谨的研究规划助手（Planner）。你的任务是把用户问题拆解为多个可并行的分析任务。\n" +
            "输出必须是严格 JSON（不要 Markdown，不要代码块），结构如下：\n" +
            "{\n" +
            '  "objective": "...",\n' +
            '  "tasks": [\n' +
            '    {"id":"t1","title":"...","goal":"...","suggestedTools":["rag_search","sql_query"]}\n' +
            "  ]\n" +
            "}\n" +
            "要求：\n" +
            `1) tasks 数量不超过 ${maxTasks}\n` +
            "2) 每个任务 goal 具体、可验证\n" +
            "3) suggestedTools 只能从 rag_search/sql_query/web_search 中选择\n" +
            "4) 任务之间尽量去重，覆盖不同角度（统计/主题/外部背景等）\n";

        const userPrompt =
            "用户问题：" +
            question +
            "\n\n" +
            "补充上下文（如有）：\n" +
            `sessionId=${context.sessionId || ""}\n` +
            `conversationId=${(context as any).conversationId || ""}\n`;

        const messages: BaseMessage[] = [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)];

        const stream = await this.textGeneratorService.streamWithMessages(undefined, messages, undefined);

        let full = "";
        for await (const chunk of stream) {
            if (typeof chunk.content === "string" && chunk.content) {
                full += chunk.content;
            }
        }

        const jsonText = this._extractLikelyJson(full);
        const parsed = JSON.parse(jsonText) as DeepResearchPlan;

        if (!parsed || !parsed.objective || !Array.isArray(parsed.tasks)) {
            throw new Error("Planner 输出格式不正确");
        }

        if (parsed.tasks.length === 0) {
            throw new Error("Planner 未生成任何任务");
        }

        return parsed;
    }

    private _attachConstraintsToBlock(): string {
        return (
            "要求：\n" +
            "1) claims 至少 2 条，且每条都要能被 evidence 支撑\n" +
            "2) evidence 的 source 只能是 rag_search/sql_query/web_search/llm\n" +
            "3) 当 source 不是 llm 时，ref 必填且必须来自工具输出的 __ref（不要编造）\n" +
            "4) 如果缺少足够证据，请在 limitations 里明确说明\n"
        );
    }

    private async _validateCoABlockEvidence(sessionId: string, block: CoABlock): Promise<string[]> {
        const errors: string[] = [];
        const sourcesNeedRef = new Set(["rag_search", "sql_query", "web_search"]);

        if (!Array.isArray(block.evidence)) {
            errors.push("evidence 必须是数组");
            return errors;
        }

        for (let i = 0; i < block.evidence.length; i++) {
            const e = block.evidence[i];
            if (!e || typeof e !== "object") {
                errors.push(`evidence[${i}] 不是对象`);
                continue;
            }

            const source = (e as any).source as string;
            if (!sourcesNeedRef.has(source)) {
                continue;
            }

            const ref = (e as any).ref;
            if (typeof ref !== "string" || ref.trim().length === 0) {
                errors.push(`evidence[${i}].ref 缺失（source=${source}）`);
                continue;
            }

            try {
                await this.variableSpaceService.get(sessionId, ref);
            } catch {
                errors.push(`evidence[${i}].ref 不可追溯（变量不存在）: ${ref}`);
            }
        }

        return errors;
    }

    private async _runAnalysisTask(
        question: string,
        task: DeepResearchTask,
        context: ToolContext,
        maxToolRounds: number
    ): Promise<CoABlock> {
        if (!context.sessionId || context.sessionId.trim().length === 0) {
            throw new Error("缺少 sessionId，无法执行分析任务（需要变量空间）");
        }

        const strictContext: ToolContext = {
            ...context,
            __requireEvidenceRef: true,
            __deepResearchTaskId: task.id
        };

        const baseSystemPrompt =
            "你是一个专业分析智能体（Analysis Agent）。你需要围绕给定任务进行深入分析。\n" +
            "你可以调用工具获取证据，但必须基于工具结果进行结论。\n" +
            "重要：系统会自动把每次工具调用输出归档到变量空间，并在工具结果中附带字段 __ref（字符串）。\n" +
            "当 evidence.source 是 rag_search/sql_query/web_search 时，evidence.ref 必须填写对应工具输出里的 __ref，且必须可在变量空间中 var_get(ref) 找到。\n" +
            "最终输出必须是严格 JSON（不要 Markdown，不要代码块），结构如下：\n" +
            "{\n" +
            '  "id": "t1",\n' +
            '  "title": "...",\n' +
            '  "goal": "...",\n' +
            '  "claims": [{"statement":"...","confidence":"high"}],\n' +
            '  "evidence": [{"source":"sql_query","note":"...","ref":"evidence.tool_call.<id>"}],\n' +
            '  "limitations": ["..."],\n' +
            '  "nextQuestions": ["..."]\n' +
            "}\n" +
            this._attachConstraintsToBlock();

        const userMessage =
            `总问题：${question}\n` +
            `当前任务：${task.title}\n` +
            `任务目标：${task.goal}\n` +
            `建议工具：${task.suggestedTools.join(", ")}`;

        const dummyChunk = () => {
            // 深度研究属于后台结构化能力，默认不向调用方输出流式 chunk
        };

        const maxAttempts = 2;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const systemPrompt =
                attempt === 1
                    ? baseSystemPrompt
                    : baseSystemPrompt +
                      "\n\n补充强制要求：\n" +
                      "- 对于每条非 llm evidence，必须复制粘贴工具结果里的 __ref 到 evidence.ref（不允许留空、不允许自造）。\n" +
                      "- 如果你无法找到对应 __ref，请继续调用工具获取证据，直到可以给出可追溯 ref。\n";

            const result = await this.agentExecutor.executeStream(
                userMessage,
                strictContext,
                dummyChunk,
                { maxToolRounds },
                [],
                systemPrompt
            );

            const jsonText = this._extractLikelyJson(result.content);
            const block = JSON.parse(jsonText) as CoABlock;

            if (!block || !block.id || !block.title) {
                throw new Error(`Analysis 任务输出格式不正确: ${task.id}`);
            }

            const evidenceErrors = await this._validateCoABlockEvidence(context.sessionId, block);
            if (evidenceErrors.length === 0) {
                return block;
            }

            this.LOGGER.warning(
                `CoA evidence.ref 校验失败(task=${task.id}, attempt=${attempt}/${maxAttempts}): ${evidenceErrors.join("; ")}`
            );

            if (attempt === maxAttempts) {
                throw new Error(`CoA evidence.ref 不可追溯: ${evidenceErrors.join("; ")}`);
            }
        }

        throw new Error(`Analysis 任务失败(未知原因): ${task.id}`);
    }

    /**
     * 并发执行 helper（不引入额外依赖）
     */
    private async _runWithConcurrencyLimit<TInput, TOutput>(
        items: TInput[],
        concurrency: number,
        runner: (item: TInput) => Promise<TOutput>
    ): Promise<TOutput[]> {
        if (items.length === 0) {
            return [];
        }

        const actualConcurrency = concurrency <= 0 ? 1 : concurrency;
        const results: TOutput[] = new Array(items.length);

        let nextIndex = 0;
        const workers: Array<Promise<void>> = [];

        const worker = async () => {
            while (true) {
                const currentIndex = nextIndex;
                nextIndex++;

                if (currentIndex >= items.length) {
                    return;
                }

                try {
                    results[currentIndex] = await runner(items[currentIndex]);
                } catch (error) {
                    this.LOGGER.error(`并行任务执行失败(index=${currentIndex}): ${error}`);
                    throw error;
                }
            }
        };

        const workerCount = actualConcurrency > items.length ? items.length : actualConcurrency;
        for (let i = 0; i < workerCount; i++) {
            workers.push(worker());
        }

        await Promise.all(workers);
        return results;
    }

    /**
     * 从模型输出中提取最可能的 JSON 段（避免依赖正则）
     */
    private _extractLikelyJson(text: string): string {
        if (!text) {
            throw new Error("模型输出为空，无法解析 JSON");
        }

        const trimmed = text.trim();
        const firstCurly = trimmed.indexOf("{");
        const firstSquare = trimmed.indexOf("[");

        let start = -1;
        let openChar = "";

        if (firstCurly === -1 && firstSquare === -1) {
            throw new Error("模型输出中未找到 JSON 起始符号");
        }

        if (firstCurly !== -1 && firstSquare !== -1) {
            if (firstCurly < firstSquare) {
                start = firstCurly;
                openChar = "{";
            } else {
                start = firstSquare;
                openChar = "[";
            }
        } else if (firstCurly !== -1) {
            start = firstCurly;
            openChar = "{";
        } else {
            start = firstSquare;
            openChar = "[";
        }

        const closeChar = openChar === "{" ? "}" : "]";

        // 从末尾找到最后一个 closeChar
        let end = -1;
        for (let i = trimmed.length - 1; i >= 0; i--) {
            if (trimmed[i] === closeChar) {
                end = i;
                break;
            }
        }

        if (end === -1 || end <= start) {
            throw new Error("模型输出中 JSON 结束符号不完整");
        }

        return trimmed.substring(start, end + 1);
    }
}
