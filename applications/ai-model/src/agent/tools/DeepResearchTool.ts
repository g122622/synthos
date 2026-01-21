import "reflect-metadata";
import { inject, injectable } from "tsyringe";
import Logger from "@root/common/util/Logger";
import { ToolDefinition, ToolExecutor, ToolContext } from "../contracts/tools";
import { AI_MODEL_TOKENS } from "../../di/tokens";
import { DeepResearchOrchestrator } from "../services/DeepResearchOrchestrator";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import { COMMON_TOKENS } from "@root/common/di/tokens";

interface DeepResearchParams {
    /** 研究问题 */
    question: string;
    /** 最大任务数（可选） */
    maxTasks?: number;
    /** 并发度（可选） */
    concurrency?: number;
}

/**
 * deep_research 工具：Planner 拆解 + 并行分析（CoA 写入变量空间）
 */
@injectable()
export class DeepResearchTool {
    private LOGGER = Logger.withTag("DeepResearchTool");

    public constructor(
        @inject(AI_MODEL_TOKENS.DeepResearchOrchestrator) private orchestrator: DeepResearchOrchestrator,
        @inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService
    ) {}

    public getDefinition(): ToolDefinition {
        return {
            type: "function",
            function: {
                name: "deep_research",
                description:
                    "执行深度研究：先将问题拆解为多个并行任务，再分别调用工具分析，产出 CoA 块并写入变量空间。\n" +
                    "适用于需要多角度、可追溯分析的复杂问题。",
                parameters: {
                    type: "object",
                    properties: {
                        question: {
                            type: "string",
                            description: "研究问题"
                        },
                        maxTasks: {
                            type: "number",
                            description: "最多拆解为多少个任务，默认 4，最大 8",
                            default: 4
                        },
                        concurrency: {
                            type: "number",
                            description: "并发执行任务数量，默认 2，最大 5",
                            default: 2
                        }
                    },
                    required: ["question"]
                }
            }
        };
    }

    public getExecutor(): ToolExecutor<DeepResearchParams> {
        return async (params: DeepResearchParams, context: ToolContext) => {
            const sessionId = context.sessionId;
            if (!sessionId) {
                throw new Error("缺少 sessionId，无法执行 deep_research");
            }

            const question = params.question;

            const maxTasksRaw = typeof params.maxTasks === "number" ? params.maxTasks : 4;
            const maxTasks = maxTasksRaw > 8 ? 8 : maxTasksRaw;

            const concurrencyRaw = typeof params.concurrency === "number" ? params.concurrency : 2;
            const concurrency = concurrencyRaw > 5 ? 5 : concurrencyRaw;

            const config = await this.configManagerService.getCurrentConfig();
            const maxConcurrentRequests = config.ai.maxConcurrentRequests;

            // 防止并发度超过全局限额
            const effectiveConcurrency = concurrency > maxConcurrentRequests ? maxConcurrentRequests : concurrency;

            this.LOGGER.info(
                `执行 deep_research: sessionId=${sessionId}, maxTasks=${maxTasks}, concurrency=${effectiveConcurrency}`
            );

            const result = await this.orchestrator.run(question, context, {
                concurrency: effectiveConcurrency,
                maxTasks,
                maxToolRoundsPerTask: 6
            });

            return {
                objective: result.plan.objective,
                taskCount: result.plan.tasks.length,
                tasks: result.plan.tasks,
                coaKeys: result.coaKeys,
                note: "已将计划与 CoA 块写入变量空间：deep_research.plan / deep_research.coa.* / deep_research.coa_index。后续可用 var_get 读取。"
            };
        };
    }
}
