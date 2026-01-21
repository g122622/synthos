import "reflect-metadata";
import { inject, injectable } from "tsyringe";
import Logger from "@root/common/util/Logger";
import { ToolDefinition, ToolExecutor, ToolContext } from "../contracts/tools";
import { AI_MODEL_TOKENS } from "../../di/tokens";
import { VariableSpaceService } from "../services/VariableSpaceService";

interface VarSetParams {
    /** 变量 key */
    key: string;
    /** 变量值（可 JSON 序列化） */
    value: unknown;
    /** 摘要（用于目录展示） */
    summary?: string;
}

/**
 * var_set 工具：写入变量空间
 */
@injectable()
export class VarSetTool {
    private LOGGER = Logger.withTag("VarSetTool");

    public constructor(
        @inject(AI_MODEL_TOKENS.VariableSpaceService) private variableSpaceService: VariableSpaceService
    ) {}

    public getDefinition(): ToolDefinition {
        return {
            type: "function",
            function: {
                name: "var_set",
                description:
                    "向变量空间写入一个变量。适用于保存中间结论、关键数据、查询结果摘要等，供后续步骤复用。",
                parameters: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "变量 key，例如: analysis.summary 或 sql.top_speakers"
                        },
                        value: {
                            description: "变量值（必须可 JSON 序列化）",
                            anyOf: [
                                { type: "object" },
                                { type: "array" },
                                { type: "string" },
                                { type: "number" },
                                { type: "boolean" },
                                { type: "null" }
                            ]
                        },
                        summary: {
                            type: "string",
                            description: "该变量的简短摘要，用于目录展示（建议 20~80 字）"
                        }
                    },
                    required: ["key", "value"]
                }
            }
        };
    }

    public getExecutor(): ToolExecutor<VarSetParams> {
        return async (params: VarSetParams, context: ToolContext) => {
            const sessionId = context.sessionId;
            if (!sessionId) {
                throw new Error("缺少 sessionId，无法使用变量空间");
            }

            const key = params.key;
            const value = params.value;

            const summary =
                typeof params.summary === "string" && params.summary.trim().length > 0
                    ? params.summary
                    : `由 var_set 写入（key=${key}）`;

            this.LOGGER.info(`写入变量: ${key}`);

            const entry = await this.variableSpaceService.set(sessionId, key, value, summary);
            return {
                key: entry.key,
                summary: entry.summary,
                createdAt: entry.createdAt,
                updatedAt: entry.updatedAt
            };
        };
    }
}
