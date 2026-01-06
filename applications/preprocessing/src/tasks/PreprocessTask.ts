import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { AccumulativeSplitter } from "../splitters/AccumulativeSplitter";
import { TimeoutSplitter } from "../splitters/TimeoutSplitter";
import Logger from "@root/common/util/Logger";
import { ProcessedChatMessage } from "@root/common/contracts/data-provider";
import { formatMsg } from "../formatMsg";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { getConfigManagerService } from "@root/common/di/container";
import { TaskHandlerTypes, TaskParameters } from "@root/common/scheduler/@types/Tasks";
import { ISplitter } from "../splitters/contracts/ISplitter";
import { PREPROCESSING_TOKENS } from "../di/tokens";

/**
 * 预处理任务处理器
 * 负责对消息进行分割和预处理
 */
@injectable()
export class PreprocessTaskHandler {
    private LOGGER = Logger.withTag("🏭 [preprocessor-root-script] [PreprocessTask]");

    /**
     * 构造函数
     * @param imDbAccessService IM 数据库访问服务
     */
    public constructor(
        @inject(PREPROCESSING_TOKENS.ImDbAccessService) private imDbAccessService: ImDbAccessService
    ) {}

    /**
     * 注册任务到 Agenda 调度器
     */
    public async register(): Promise<void> {
        const configManagerService = getConfigManagerService();
        let config = await configManagerService.getCurrentConfig();

        await agendaInstance
            .create(TaskHandlerTypes.Preprocess)
            .unique({ name: TaskHandlerTypes.Preprocess }, { insertOnly: true })
            .save();

        agendaInstance.define<TaskParameters<TaskHandlerTypes.Preprocess>>(
            TaskHandlerTypes.Preprocess,
            async job => {
                this.LOGGER.info(`😋开始处理任务: ${job.attrs.name}`);
                const attrs = job.attrs.data;
                config = await configManagerService.getCurrentConfig(); // 刷新配置

                for (const groupId of attrs.groupIds) {
                    let splitter: ISplitter;
                    switch (config.groupConfigs[groupId]?.splitStrategy) {
                        case "accumulative": {
                            splitter = new AccumulativeSplitter();
                            break;
                        }
                        case "realtime": {
                            splitter = new TimeoutSplitter();
                            break;
                        }
                        default: {
                            this.LOGGER.warning(
                                `未知的分割策略: ${config.groupConfigs[groupId]?.splitStrategy}，使用accumulative策略兜底`
                            );
                            splitter = new AccumulativeSplitter();
                            break;
                        }
                    }

                    // 开始消息分割，分配sessionId
                    await splitter.init();
                    const results = await Promise.all(
                        (
                            await splitter.assignSessionId(
                                this.imDbAccessService,
                                groupId,
                                attrs.startTimeStamp,
                                attrs.endTimeStamp
                            )
                        ).map<Promise<ProcessedChatMessage>>(async result => {
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
                    await job.touch(); // 保活
                }

                this.LOGGER.success(`🥳任务完成: ${job.attrs.name}`);
            },
            {
                concurrency: 1,
                priority: "high"
            }
        );
    }
}
