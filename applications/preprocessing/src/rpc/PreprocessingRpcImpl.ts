/**
 * Preprocessing RPC 实现
 * 将 PreprocessTaskHandler 暴露为 tRPC procedure
 */
import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import Logger from "@root/common/util/Logger";
import {
    PreprocessingRPCImplementation,
    PreprocessInput,
    PreprocessOutput
} from "@root/common/rpc/preprocessing/index";

import { PREPROCESSING_TOKENS } from "../di/tokens";
import { PreprocessTaskHandler } from "../tasks/PreprocessTask";

/**
 * Preprocessing RPC 实现类
 */
@injectable()
export class PreprocessingRpcImpl implements PreprocessingRPCImplementation {
    private LOGGER = Logger.withTag("PreprocessingRpcImpl");

    public constructor(
        @inject(PREPROCESSING_TOKENS.PreprocessTaskHandler) private preprocessTaskHandler: PreprocessTaskHandler
    ) {}

    /**
     * 预处理
     * @param input 预处理输入
     * @returns 预处理结果
     */
    public async preprocess(input: PreprocessInput): Promise<PreprocessOutput> {
        this.LOGGER.info(`收到 preprocess 请求: groupIds=${input.groupIds.join(",")}`);

        return this.preprocessTaskHandler.run(input);
    }
}
