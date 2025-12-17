/**
 * 聊天消息服务
 */
import { injectable, inject } from "tsyringe";
import { TOKENS } from "../di/tokens";
import { IMDBManager } from "@root/common/database/IMDBManager";

@injectable()
export class ChatMessageService {
    constructor(
        @inject(TOKENS.IMDBManager) private imDBManager: IMDBManager
    ) {}

    /**
     * 根据群组 ID 和时间范围获取聊天消息
     */
    async getChatMessagesByGroupIdAndTimeRange(
        groupId: string,
        timeStart: number,
        timeEnd: number
    ) {
        return await this.imDBManager.getProcessedChatMessageWithRawMessageByGroupIdAndTimeRange(
            groupId,
            timeStart,
            timeEnd
        );
    }

    /**
     * 根据多个群组 ID 和时间范围获取 sessionId 列表
     */
    async getSessionIdsByGroupIdsAndTimeRange(
        groupIds: string[],
        timeStart: number,
        timeEnd: number
    ) {
        const results = [];
        for (const groupId of groupIds) {
            const sessionIds = await this.imDBManager.getSessionIdsByGroupIdAndTimeRange(
                groupId,
                timeStart,
                timeEnd
            );
            results.push({ groupId, sessionIds });
        }
        return results;
    }

    /**
     * 获取多个 sessionId 的时间范围
     */
    async getSessionTimeDurations(sessionIds: string[]) {
        const results = [];
        for (const sessionId of sessionIds) {
            const result = await this.imDBManager.getSessionTimeDuration(sessionId);
            results.push({
                sessionId,
                timeStart: result?.timeStart,
                timeEnd: result?.timeEnd
            });
        }
        return results;
    }
}

