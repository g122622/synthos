import "reflect-metadata";
import { inject, injectable } from "tsyringe";
import Logger from "@root/common/util/Logger";
import { ToolDefinition, ToolExecutor, ToolContext } from "../contracts/tools";
import { AI_MODEL_TOKENS } from "../../di/tokens";
import { VariableSpaceService } from "../services/VariableSpaceService";

interface VarGetParams {
    /** 变量 key */
    key: string;
}

/**
 * var_get 工具：读取变量空间
 */
@injectable()
export class VarGetTool {
    private LOGGER = Logger.withTag("VarGetTool");

    public constructor(
        @inject(AI_MODEL_TOKENS.VariableSpaceService) private variableSpaceService: VariableSpaceService
    ) {}

    public getDefinition(): ToolDefinition {
        return {
            type: "function",
            function: {
                name: "var_get",
                description: "从变量空间读取一个变量。",
                parameters: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "变量 key"
                        }
                    },
                    required: ["key"]
                }
            }
        };
    }

    public getExecutor(): ToolExecutor<VarGetParams> {
        return async (params: VarGetParams, context: ToolContext) => {
            const sessionId = context.sessionId;
            if (!sessionId) {
                throw new Error("缺少 sessionId，无法使用变量空间");
            }

            const key = params.key;
            this.LOGGER.info(`读取变量: ${key}`);

            const entry = await this.variableSpaceService.get(sessionId, key);
            return {
                key: entry.key,
                summary: entry.summary,
                createdAt: entry.createdAt,
                updatedAt: entry.updatedAt,
                value: entry.value
            };
        };
    }
}
