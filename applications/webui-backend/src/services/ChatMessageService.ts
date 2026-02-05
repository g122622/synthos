/**
 * 聊天消息服务
 */
import { injectable, inject } from "tsyringe";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";

import { TOKENS } from "../di/tokens";

@injectable()
export class ChatMessageService {
    constructor(@inject(TOKENS.ImDbAccessService) private imDbAccessService: ImDbAccessService) {}

    /**
     * 根据群组 ID 和时间范围获取聊天消息
     */
    async getChatMessagesByGroupIdAndTimeRange(groupId: string, timeStart: number, timeEnd: number) {
        return await this.imDbAccessService.getProcessedChatMessageWithRawMessageByGroupIdAndTimeRange(
            groupId,
            timeStart,
            timeEnd
        );
    }

    /**
     * 根据多个群组 ID 和时间范围获取 sessionId 列表
     */
    async getSessionIdsByGroupIdsAndTimeRange(groupIds: string[], timeStart: number, timeEnd: number) {
        const results = [];

        for (const groupId of groupIds) {
            const sessionIds = await this.imDbAccessService.getSessionIdsByGroupIdAndTimeRange(
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
            const result = await this.imDbAccessService.getSessionTimeDuration(sessionId);

            results.push({
                sessionId,
                timeStart: result?.timeStart,
                timeEnd: result?.timeEnd
            });
        }

        return results;
    }

    /**
     * 获取多个群组的每小时消息统计（包括当前24小时和前一天24小时）
     * 时间槽采用整点对齐方式
     * @param groupIds 群组ID数组
     * @returns 聚合统计结果
     */
    async getMessageHourlyStats(groupIds: string[]): Promise<{
        data: Record<string, { current: number[]; previous: number[] }>;
        timestamps: { current: number[]; previous: number[] };
        totalCounts: { current: number; previous: number };
    }> {
        // 计算时间范围（整点对齐）
        const now = new Date();
        // 当前小时的整点（例如：如果现在是13:45，则为13:00）
        const currentHourStart = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            now.getHours(),
            0,
            0,
            0
        ).getTime();

        // 当前24小时：从23小时前的整点到当前小时整点（共24个小时槽）
        const currentPeriodStart = currentHourStart - 23 * 60 * 60 * 1000;
        const currentPeriodEnd = currentHourStart + 60 * 60 * 1000; // 当前小时结束

        // 前一天24小时：往前再推24小时
        const previousPeriodStart = currentPeriodStart - 24 * 60 * 60 * 1000;
        const previousPeriodEnd = currentPeriodStart;

        // 生成时间戳数组（24个整点）
        const currentTimestamps: number[] = [];
        const previousTimestamps: number[] = [];

        for (let i = 0; i < 24; i++) {
            currentTimestamps.push(currentPeriodStart + i * 60 * 60 * 1000);
            previousTimestamps.push(previousPeriodStart + i * 60 * 60 * 1000);
        }

        // 从数据库获取原始聚合数据
        const [currentRawStats, previousRawStats] = await Promise.all([
            this.imDbAccessService.getMessageHourlyStatsByGroupIds(groupIds, currentPeriodStart, currentPeriodEnd),
            this.imDbAccessService.getMessageHourlyStatsByGroupIds(
                groupIds,
                previousPeriodStart,
                previousPeriodEnd
            )
        ]);

        // 构建结果数据结构
        const data: Record<string, { current: number[]; previous: number[] }> = {};

        // 初始化每个群组的统计数组
        for (const groupId of groupIds) {
            data[groupId] = {
                current: new Array(24).fill(0),
                previous: new Array(24).fill(0)
            };
        }

        // 填充当前24小时数据
        for (const stat of currentRawStats) {
            const hourIndex = Math.floor((stat.hourTimestamp - currentPeriodStart) / (60 * 60 * 1000));

            if (hourIndex >= 0 && hourIndex < 24 && data[stat.groupId]) {
                data[stat.groupId].current[hourIndex] = stat.count;
            }
        }

        // 填充前一天24小时数据
        for (const stat of previousRawStats) {
            const hourIndex = Math.floor((stat.hourTimestamp - previousPeriodStart) / (60 * 60 * 1000));

            if (hourIndex >= 0 && hourIndex < 24 && data[stat.groupId]) {
                data[stat.groupId].previous[hourIndex] = stat.count;
            }
        }

        // 计算总消息数
        let currentTotal = 0;
        let previousTotal = 0;

        for (const groupId of groupIds) {
            currentTotal += data[groupId].current.reduce((sum, count) => sum + count, 0);
            previousTotal += data[groupId].previous.reduce((sum, count) => sum + count, 0);
        }

        return {
            data,
            timestamps: {
                current: currentTimestamps,
                previous: previousTimestamps
            },
            totalCounts: {
                current: currentTotal,
                previous: previousTotal
            }
        };
    }
}
