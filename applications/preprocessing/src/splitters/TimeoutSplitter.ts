import "reflect-metadata";
import { getConfigManagerService } from "@root/common/di/container";
import { ISplitter } from "./contracts/ISplitter";
import getRandomHash from "@root/common/util/getRandomHash";
import { ImDbAccessService} from "@root/common/services/database/ImDbAccessService";
import { getMinutesAgoTimestamp } from "@root/common/util/TimeUtils";
import { Disposable } from "@root/common/util/lifecycle/Disposable";
import { mustInitBeforeUse } from "@root/common/util/lifecycle/mustInitBeforeUse";

@mustInitBeforeUse
export class TimeoutSplitter extends Disposable implements ISplitter {
    public async init() { }

    public async assignSessionId(imDbAccessService: ImDbAccessService, groupId: string, startTimeStamp: number,
        endTimeStamp: number) {
        const config = (await getConfigManagerService().getCurrentConfig()).preprocessors
            .TimeoutSplitter;

        // 获取配置的超时阈值（单位：毫秒）
        const timeoutThresholdMs = config.timeoutInMinutes * 60 * 1000;

        const msgs = await imDbAccessService.getProcessedChatMessageWithRawMessageByGroupIdAndTimeRange(
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
