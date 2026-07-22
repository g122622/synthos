import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import Logger from "@root/common/util/Logger";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { ProvideDataInput, ProvideDataOutput } from "@root/common/rpc/data-provider/index";
import { IMTypes, RawChatMessage } from "@root/common/contracts/data-provider/index";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";

import { IIMProvider } from "../providers/contracts/IIMProvider";
import { COMMON_TOKENS } from "../di/tokens";
import { getQQProvider } from "../di/container";

/**
 * 数据提供任务处理器
 * 负责从各种 IM 平台获取消息并存储到数据库
 * 使用并发查询，多个群组同时获取消息
 */
@injectable()
export class ProvideDataTaskHandler {
    private LOGGER = Logger.withTag("🌏 ProvideDataTask");

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
     * 执行数据提供任务
     * 从 IM 平台拉取指定群组、时间范围内的消息并落库
     * @param params 任务参数
     * @returns 执行结果
     */
    public async run(params: ProvideDataInput): Promise<ProvideDataOutput> {
        this.LOGGER.info(`😋开始处理数据提供任务`);
        const { IMType, groupIds, startTimeStamp, endTimeStamp } = params;

        // 根据 IM 类型从 DI 容器获取对应的 IM 提供者
        let activeProvider: IIMProvider;

        switch (IMType) {
            case IMTypes.QQ: {
                activeProvider = getQQProvider();
                break;
            }
            default: {
                this.LOGGER.error(`Unknown IM type: ${IMType}`);
                throw new Error(`Unknown IM type: ${IMType}`);
            }
        }

        await activeProvider.init();
        this.LOGGER.info(`IM provider initialized for ${IMType}`);

        try {
            // 并发处理所有群组的消息获取
            const groupPromises = groupIds.map(async (groupId: string) => {
                this.LOGGER.debug(`开始获取群 ${groupId} 的消息`);

                let results: RawChatMessage[] = [];

                if (startTimeStamp < 0) {
                    const newestMsg = await this.imDbAccessService.getNewestRawChatMessageByGroupId(groupId);
                    const realStartTimeStamp = newestMsg ? newestMsg.timestamp - 1000 : 0;

                    results = await activeProvider.getMsgByTimeRange(realStartTimeStamp, endTimeStamp, groupId);
                } else {
                    results = await activeProvider.getMsgByTimeRange(startTimeStamp, endTimeStamp, groupId);
                }

                this.LOGGER.success(`群 ${groupId} 成功获取到 ${results.length} 条有效消息`);

                return { groupId, results };
            });

            const settled = await Promise.allSettled(groupPromises);

            for (const result of settled) {
                if (result.status === "fulfilled") {
                    await this.imDbAccessService.storeRawChatMessages(result.value.results);
                } else {
                    this.LOGGER.error(`群消息获取失败: ${result.reason}`);
                }
            }
        } finally {
            // 保证线程池总是被销毁，避免 Worker 线程及其原生 DB 连接泄漏
            try {
                await activeProvider.dispose();
            } catch (disposeError: any) {
                this.LOGGER.error(`Provider dispose 失败: ${disposeError?.message ?? String(disposeError)}`);
            }
        }

        this.LOGGER.success(`🥳数据提供任务完成`);

        return { success: true };
    }
}
