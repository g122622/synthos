import "reflect-metadata";
import { inject, injectable } from "tsyringe";
import Logger from "@root/common/util/Logger";
import { ToolDefinition, ToolExecutor, ToolContext } from "../contracts/tools";
import { AI_MODEL_TOKENS } from "../../di/tokens";
import { VariableSpaceService } from "../services/VariableSpaceService";

interface VarListParams {
    /** key 前缀过滤（可选） */
    prefix?: string;
    /** 返回数量限制（可选） */
    limit?: number;
}

/**
 * var_list 工具：列出变量目录
 */
@injectable()
export class VarListTool {
    private LOGGER = Logger.withTag("VarListTool");

    public constructor(
        @inject(AI_MODEL_TOKENS.VariableSpaceService) private variableSpaceService: VariableSpaceService
    ) {}

    public getDefinition(): ToolDefinition {
        return {
            type: "function",
            function: {
                name: "var_list",
                description: "列出当前会话变量空间中的变量目录（key + summary）。",
                parameters: {
                    type: "object",
                    properties: {
                        prefix: {
                            type: "string",
                            description: "按 key 前缀过滤，例如: analysis."
                        },
                        limit: {
                            type: "number",
                            description: "返回数量限制，默认 30，最大 200",
                            default: 30
                        }
                    },
                    required: []
                }
            }
        };
    }

    public getExecutor(): ToolExecutor<VarListParams> {
        return async (params: VarListParams, context: ToolContext) => {
            const sessionId = context.sessionId;
            if (!sessionId) {
                throw new Error("缺少 sessionId，无法使用变量空间");
            }

            const prefix = params.prefix;

            const limitRaw = typeof params.limit === "number" ? params.limit : 30;
            const limit = limitRaw > 200 ? 200 : limitRaw;

            this.LOGGER.info(`列出变量目录: prefix=${prefix ? prefix : "(无)"}, limit=${limit}`);

            const metas = await this.variableSpaceService.list(sessionId, prefix, limit);
            return {
                total: metas.length,
                items: metas
            };
        };
    }
}
