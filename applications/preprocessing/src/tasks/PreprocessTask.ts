import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import Logger from "@root/common/util/Logger";
import { ProcessedChatMessage } from "@root/common/contracts/data-provider";
import { registerTask } from "@root/common/scheduler/registry/index";
import { PreprocessParamsSchema, PreprocessTaskDefinition } from "@root/common/scheduler/taskDefinitions/index";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import { Runnable } from "@root/common/util/type/Runnable";
import z from "zod";
import { DeepRequired } from "@root/common/util/type/DeepRequired";

import { formatMsg } from "../formatMsg";
import { ISplitter } from "../splitters/contracts/ISplitter";
import { COMMON_TOKENS } from "../di/tokens";
import { getAccumulativeSplitter, getTimeoutSplitter } from "../di/container";

/**
 * 预处理任务处理器
 * 负责对消息进行分割和预处理
 */
@injectable()
@registerTask(PreprocessTaskDefinition)
export class PreprocessTaskHandler implements Runnable {
    private LOGGER = Logger.withTag("🏭 PreprocessTask");

    /**
     * 构造函数
     * @param configManagerService 配置管理服务
     * @param imDbAccessService IM 数据库访问服务
     */
    public constructor(
        @inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService,
        @inject(COMMON_TOKENS.ImDbAccessService) private imDbAccessService: ImDbAccessService
    ) {}

    /**
     * 执行任务
     */
    public async run(params: DeepRequired<z.infer<typeof PreprocessParamsSchema>>): Promise<void> {
        const config = await this.configManagerService.getCurrentConfig();

        for (const groupId of params.groupIds) {
            const groupConfig = config.groupConfigs[groupId];

            if (!groupConfig) {
                throw new Error(`群组配置不存在: ${groupId}`);
            }

            // 从 DI 容器获取对应的分割器
            let splitter: ISplitter;

            switch (groupConfig.splitStrategy) {
                case "accumulative": {
                    splitter = getAccumulativeSplitter();
                    break;
                }
                case "realtime": {
                    splitter = getTimeoutSplitter();
                    break;
                }
                default: {
                    this.LOGGER.warning(
                        `未知的分割策略: ${groupConfig.splitStrategy}，使用 accumulative 策略兜底`
                    );
                    splitter = getAccumulativeSplitter();
                    break;
                }
            }

            // 开始消息分割，分配 sessionId
            await splitter.init();

            const results = await Promise.all(
                (await splitter.assignSessionId(groupId, params.startTimeStamp, params.endTimeStamp)).map<
                    Promise<ProcessedChatMessage>
                >(async result => {
                    return {
                        sessionId: result.sessionId!,
                        msgId: result.msgId,
                        preProcessedContent: formatMsg(
                            result,
                            result.quotedMsgId
                                ? await this.imDbAccessService.getRawChatMessageByMsgId(result.quotedMsgId)
                                : undefined,
                            result.quotedMsgContent
                        )
                    };
                })
            );

            await this.imDbAccessService.storeProcessedChatMessages(results);
            await splitter.dispose();

            this.LOGGER.success(`为群 ${groupId} 分配了 ${results.length} 条消息`);
        }
    }
}
