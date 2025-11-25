import { ISplitter } from "./@types/ISplitter";
import getRandomHash from "@root/common/util/getRandomHash";
import ConfigManagerService from "@root/common/config/ConfigManagerService";
import { IMDBManager } from "@root/common/database/IMDBManager";
import { getMinutesAgoTimestamp } from "@root/common/util/TimeUtils";
import { Disposable } from "@root/common/util/lifecycle/Disposable";

export class TimeoutSplitter extends Disposable implements ISplitter {
    public async init() {}

    public async assignSessionId(imdbManager: IMDBManager, groupId: string, minutesAgo: number) {
        const config = (await ConfigManagerService.getCurrentConfig()).preprocessors
            .TimeoutSplitter;

        // 获取配置的超时阈值（单位：毫秒）
        const timeoutThresholdMs = config.timeoutInMinutes * 60 * 1000;

        const msgs = await imdbManager.getProcessedChatMessageWithRawMessageByGroupIdAndTimeRange(
            groupId,
            getMinutesAgoTimestamp(minutesAgo),
            Date.now()
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
