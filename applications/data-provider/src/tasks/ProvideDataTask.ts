import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import Logger from "@root/common/util/Logger";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { registerTask } from "@root/common/scheduler/registry/index";
import { IMTypes } from "@root/common/contracts/data-provider/index";
import { ProvideDataParamsSchema, ProvideDataTaskDefinition } from "@root/common/scheduler/taskDefinitions/index";
import { Runnable } from "@root/common/util/type/Runnable";
import z from "zod";

import { IIMProvider } from "../providers/contracts/IIMProvider";
import { COMMON_TOKENS } from "../di/tokens";
import { getQQProvider } from "../di/container";

/**
 * 数据提供任务处理器
 * 负责从各种 IM 平台获取消息并存储到数据库
 */
@injectable()
@registerTask(ProvideDataTaskDefinition)
export class ProvideDataTaskHandler implements Runnable {
    private LOGGER = Logger.withTag("🌏 ProvideDataTask");

    /**
     * 构造函数
     * @param configManagerService 配置管理服务
     * @param imDbAccessService IM 数据库访问服务
     */
    public constructor(@inject(COMMON_TOKENS.ImDbAccessService) private imDbAccessService: ImDbAccessService) {}

    /**
     * 执行任务
     */
    public async run(params: z.infer<typeof ProvideDataParamsSchema>): Promise<void> {
        // 根据 IM 类型从 DI 容器获取对应的 IM 提供者
        let activeProvider: IIMProvider;

        switch (params.IMType) {
            case IMTypes.QQ: {
                activeProvider = getQQProvider();
                break;
            }
            default: {
                this.LOGGER.error(`未知的 IM 类型: ${params.IMType}`);
                throw new Error(`未知的 IM 类型: ${params.IMType}`);
            }
        }

        await activeProvider.init();
        this.LOGGER.debug(`IM provider initialized for ${params.IMType}`);

        for (const groupId of params.groupIds) {
            this.LOGGER.debug(`开始获取群 ${groupId} 的消息`);

            const results = await activeProvider.getMsgByTimeRange(
                params.startTimeStamp < 0 // 如果是负数则代表自动获取时间范围
                    ? (await this.imDbAccessService.getNewestRawChatMessageByGroupId(groupId)).timestamp - 1000 // 避免漏掉最后一条消息，回溯1秒
                    : params.startTimeStamp,
                params.endTimeStamp,
                groupId
            );

            this.LOGGER.success(`群 ${groupId} 成功获取到 ${results.length} 条有效消息`);
            await this.imDbAccessService.storeRawChatMessages(results);
        }
        await activeProvider.dispose();
    }
}
