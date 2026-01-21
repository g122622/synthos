import "reflect-metadata";
import { inject, injectable } from "tsyringe";
import Logger from "@root/common/util/Logger";
import { ToolDefinition, ToolExecutor, ToolContext } from "../contracts/tools";
import { AI_MODEL_TOKENS } from "../../di/tokens";
import { VariableSpaceService } from "../services/VariableSpaceService";

interface VarDeleteParams {
    /** 变量 key */
    key: string;
}

/**
 * var_delete 工具：删除变量
 */
@injectable()
export class VarDeleteTool {
    private LOGGER = Logger.withTag("VarDeleteTool");

    public constructor(
        @inject(AI_MODEL_TOKENS.VariableSpaceService) private variableSpaceService: VariableSpaceService
    ) {}

    public getDefinition(): ToolDefinition {
        return {
            type: "function",
            function: {
                name: "var_delete",
                description: "从变量空间删除一个变量（不存在会报错）。",
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

    public getExecutor(): ToolExecutor<VarDeleteParams> {
        return async (params: VarDeleteParams, context: ToolContext) => {
            const sessionId = context.sessionId;
            if (!sessionId) {
                throw new Error("缺少 sessionId，无法使用变量空间");
            }

            const key = params.key;
            this.LOGGER.info(`删除变量: ${key}`);

            await this.variableSpaceService.delete(sessionId, key);
            return {
                deleted: true,
                key
            };
        };
    }
}
