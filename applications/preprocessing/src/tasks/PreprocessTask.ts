import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import Logger from "@root/common/util/Logger";
import { ProcessedChatMessage } from "@root/common/contracts/data-provider";
import { PreprocessInput, PreprocessOutput } from "@root/common/rpc/preprocessing/index";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";

import { formatMsg } from "../formatMsg";
import { ISplitter } from "../splitters/contracts/ISplitter";
import { COMMON_TOKENS } from "../di/tokens";
import { getAccumulativeSplitter, getTimeoutSplitter } from "../di/container";

/**
 * 预处理任务处理器
 * 负责对消息进行分割和预处理
 */
@injectable()
export class PreprocessTaskHandler {
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
     * 执行预处理任务
     * 对指定群组、时间范围内的消息进行分割和预处理并落库
     * @param params 任务参数
     * @returns 执行结果
     */
    public async run(params: PreprocessInput): Promise<PreprocessOutput> {
        this.LOGGER.info(`😋开始处理预处理任务`);
        const { groupIds, startTimeStamp, endTimeStamp } = params;

        const config = await this.configManagerService.getCurrentConfig();

        for (const groupId of groupIds) {
            // 从 DI 容器获取对应的分割器
            let splitter: ISplitter;

            switch (config.groupConfigs[groupId]?.splitStrategy) {
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
                        `未知的分割策略: ${config.groupConfigs[groupId]?.splitStrategy}，使用accumulative策略兜底`
                    );
                    splitter = getAccumulativeSplitter();
                    break;
                }
            }

            // 开始消息分割，分配sessionId
            await splitter.init();
            const results = await Promise.all(
                (await splitter.assignSessionId(groupId, startTimeStamp, endTimeStamp)).map<
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

            this.LOGGER.success(`为群${groupId}分配了${results.length}条消息`);
        }

        this.LOGGER.success(`🥳预处理任务完成`);

        return { success: true };
    }
}
