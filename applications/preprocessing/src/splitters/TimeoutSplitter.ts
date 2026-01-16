import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import { ISplitter } from "./contracts/ISplitter";
import getRandomHash from "@root/common/util/getRandomHash";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { Disposable } from "@root/common/util/lifecycle/Disposable";
import { mustInitBeforeUse } from "@root/common/util/lifecycle/mustInitBeforeUse";
import { COMMON_TOKENS } from "../di/tokens";

/**
 * 超时式消息分割器
 * 按照消息间隔时间进行分组
 */
@injectable()
@mustInitBeforeUse
export class TimeoutSplitter extends Disposable implements ISplitter {
    /**
     * 构造函数
     * @param configManagerService 配置管理服务
     */
    public constructor(
        @inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService,
        @inject(COMMON_TOKENS.ImDbAccessService) private imDbAccessService: ImDbAccessService
    ) {
        super();
    }

    /**
     * 初始化分割器
     */
    public async init() {}

    /**
     * 为消息分配 sessionId
     * @param imDbAccessService IM 数据库访问服务
     * @param groupId 群组 ID
     * @param startTimeStamp 开始时间戳
     * @param endTimeStamp 结束时间戳
     * @returns 带有 sessionId 的消息列表
     */
    public async assignSessionId(groupId: string, startTimeStamp: number, endTimeStamp: number) {
        await this.imDbAccessService.init(); // TODO : 临时解决方案，确保数据库已初始化
        const config = (await this.configManagerService.getCurrentConfig()).preprocessors.TimeoutSplitter;

        // 获取配置的超时阈值（单位：毫秒）
        const timeoutThresholdMs = config.timeoutInMinutes * 60 * 1000;

        const msgs = await this.imDbAccessService.getProcessedChatMessageWithRawMessageByGroupIdAndTimeRange(
            groupId,
            startTimeStamp,
            endTimeStamp
        );

        for (let i = 0; i < msgs.length; i++) {
            const msg = msgs[i];

            if (!msg.sessionId) {
                if (i === 0) {
                    // 第一条消息：总是分配新 sessionId
                    msg.sessionId = getRandomHash(16);
                } else {
                    const prevMsg = msgs[i - 1];
                    const timeDiff = msg.timestamp - prevMsg.timestamp;

                    if (timeDiff > timeoutThresholdMs) {
                        // 超过阈值：开启新会话
                        msg.sessionId = getRandomHash(16);
                    } else {
                        // 未超过阈值：沿用前一条的 sessionId
                        msg.sessionId = prevMsg.sessionId!;
                    }
                }
            }
        }

        return msgs;
    }
}
