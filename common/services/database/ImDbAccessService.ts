import "reflect-metadata";
import { injectable, container } from "tsyringe";
import {
    ProcessedChatMessage,
    RawChatMessage,
    ProcessedChatMessageWithRawMessage
} from "../../contracts/data-provider/index";
import Logger from "../../util/Logger";
import { CommonDBService } from "./infra/CommonDBService";
import { Disposable } from "../../util/lifecycle/Disposable";
import { mustInitBeforeUse } from "../../util/lifecycle/mustInitBeforeUse";
import { createIMDBTableSQL } from "./constants/InitialSQL";
import { COMMON_TOKENS } from "../../di/tokens";

/**
 * IM 消息数据库访问服务
 * 负责聊天消息的存储和查询
 */
@injectable()
@mustInitBeforeUse
export class ImDbAccessService extends Disposable {
    private LOGGER = Logger.withTag("ImDbAccessService");
    private db: CommonDBService | null = null;

    /**
     * 初始化数据库服务
     */
    public async init() {
        // 从 DI 容器获取 CommonDBService 实例
        this.db = container.resolve<CommonDBService>(COMMON_TOKENS.CommonDBService);
        await this.db.init(createIMDBTableSQL);
    }

    public async storeRawChatMessage(msg: RawChatMessage) {
        await this.db.run(
            `INSERT INTO chat_messages (
                msgId, messageContent, groupId, timestamp, senderId, senderGroupNickname, senderNickname, quotedMsgId, quotedMsgContent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(msgId) DO NOTHING`,
            [
                msg.msgId,
                msg.messageContent,
                msg.groupId,
                msg.timestamp,
                msg.senderId,
                msg.senderGroupNickname,
                msg.senderNickname,
                msg.quotedMsgId,
                msg.quotedMsgContent
            ]
        );
    }

    public async storeRawChatMessages(messages: RawChatMessage[]) {
        if (messages.length === 0) return;

        // 计算每批大小（每条消息9个参数，SQLite 默认最大999参数）
        const MAX_SQLITE_PARAMS = 999;
        const paramsPerRecord = 9;
        const batchSize = Math.min(100, Math.floor(MAX_SQLITE_PARAMS / paramsPerRecord));

        // 构建基础SQL模板（带冲突处理）
        const baseSql = `
        INSERT INTO chat_messages (
            msgId, messageContent, groupId, timestamp, senderId, 
            senderGroupNickname, senderNickname, quotedMsgId, quotedMsgContent
        ) VALUES ${Array(batchSize).fill("(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}
        ON CONFLICT(msgId) DO NOTHING
    `.trim();

        // 开始事务
        await this.db.run("BEGIN IMMEDIATE TRANSACTION");

        try {
            for (let i = 0; i < messages.length; i += batchSize) {
                const batch = messages.slice(i, i + batchSize);

                // 动态生成当前批次的SQL（处理最后一批不足batchSize的情况）
                const currentBatchSize = batch.length;
                const sql =
                    currentBatchSize === batchSize
                        ? baseSql
                        : baseSql.replace(
                              Array(batchSize).fill("(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", "),
                              Array(currentBatchSize).fill("(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")
                          );

                // 收集参数
                const params: any[] = [];
                batch.forEach(msg => {
                    params.push(
                        msg.msgId,
                        msg.messageContent,
                        msg.groupId,
                        msg.timestamp,
                        msg.senderId,
                        msg.senderGroupNickname,
                        msg.senderNickname,
                        msg.quotedMsgId,
                        msg.quotedMsgContent
                    );
                });

                // 执行批量插入
                await this.db.run(sql, params);
            }

            // 提交事务
            await this.db.run("COMMIT");
        } catch (err) {
            // 出错时回滚
            await this.db.run("ROLLBACK");
            this.LOGGER.error(`Failed to store messages batch: ${err.message}`);
            throw new Error(`Failed to store messages batch: ${err.message}`);
        }
    }

    /**
     * 获取指定群组在指定时间范围内的所有消息
     * @param groupId 群组ID
     * @param timeStart 起始时间戳
     * @param timeEnd 结束时间戳
     * @returns 消息列表 ！！！已经按照时间从早到晚排序
     */
    public async getRawChatMessagesByGroupIdAndTimeRange(
        groupId: string,
        timeStart: number,
        timeEnd: number
    ): Promise<RawChatMessage[]> {
        const results = await this.db.all<RawChatMessage>(
            `SELECT * FROM chat_messages WHERE groupId = ? AND (timestamp BETWEEN ? AND ?)`,
            [groupId, timeStart, timeEnd]
        );
        // 按照时间从早到晚排序
        results.sort((a, b) => a.timestamp - b.timestamp);
        return results;
    }

    /**
     * 获取指定群组在指定时间范围内的所有消息，包含预处理后的消息
     * @param groupId 群组ID
     * @param timeStart 起始时间戳
     * @param timeEnd 结束时间戳
     * @returns 消息列表 ！！！已经按照时间从早到晚排序
     */
    public async getProcessedChatMessageWithRawMessageByGroupIdAndTimeRange(
        groupId: string,
        timeStart: number,
        timeEnd: number
    ): Promise<ProcessedChatMessageWithRawMessage[]> {
        const results = await this.db.all<ProcessedChatMessageWithRawMessage>(
            `SELECT * FROM chat_messages WHERE groupId = ? AND (timestamp BETWEEN ? AND ?)`,
            [groupId, timeStart, timeEnd]
        );
        // 按照时间从早到晚排序
        results.sort((a, b) => a.timestamp - b.timestamp);
        return results;
    }

    public async getSessionIdsByGroupIdAndTimeRange(
        groupId: string,
        timeStart: number,
        timeEnd: number
    ): Promise<string[]> {
        const results = await this.db.all<{ sessionId: string }>(
            `SELECT DISTINCT sessionId FROM chat_messages WHERE groupId =? AND (timestamp BETWEEN? AND?) AND sessionId IS NOT NULL`,
            [groupId, timeStart, timeEnd]
        );
        return results.map(r => r.sessionId);
    }

    /**
     * 获取指定会话的开始和结束时间
     * @param sessionId 会话ID
     * @returns 时间戳对象 { timeStart: 开始时间, timeEnd: 结束时间 } 或者 null 如果会话不存在
     */
    public async getSessionTimeDuration(
        sessionId: string
    ): Promise<{ timeStart: number; timeEnd: number } | null> {
        const results = await this.db.all<{ timeStart: number | null; timeEnd: number | null }>(
            `SELECT MIN(timestamp) AS timeStart, MAX(timestamp) AS timeEnd FROM chat_messages WHERE sessionId = ?`,
            [sessionId]
        );

        // 过滤掉全 null 的行
        const validResults = results.filter(r => r.timeStart !== null && r.timeEnd !== null);

        if (validResults.length === 0) {
            return null;
        }

        // 从所有有效结果中取全局 min 和 max
        const timeStart = Math.min(...validResults.map(r => r.timeStart!));
        const timeEnd = Math.max(...validResults.map(r => r.timeEnd!));

        return { timeStart, timeEnd };
    }

    /**
     * 获取指定群组最新的一条已入库消息
     * @param groupId 群组ID
     * @returns 消息对象
     */
    public async getNewestRawChatMessageByGroupId(groupId: string): Promise<RawChatMessage> {
        return await this.db.get<RawChatMessage>(
            `SELECT * FROM chat_messages WHERE groupId =? ORDER BY timestamp DESC LIMIT 1`,
            [groupId]
        );
    }

    /**
     * 根据消息id获取raw消息
     * @param msgId 消息id
     * @returns 消息对象
     */
    public async getRawChatMessageByMsgId(msgId: string): Promise<RawChatMessage> {
        const result = await this.db.get<RawChatMessage>(`SELECT * FROM chat_messages WHERE msgId =?`, [msgId]);
        if (!result) {
            this.LOGGER.warning(`未找到消息id为${msgId}的消息`);
        }
        return result;
    }

    /**
     * 获取某条消息前后上下文（同群内按时间排序）
     * @param groupId 群组ID
     * @param msgId 目标消息ID
     * @param before 目标消息之前的条数
     * @param after 目标消息之后的条数
     */
    public async getProcessedChatMessagesContextByGroupIdAndMsgId(
        groupId: string,
        msgId: string,
        before: number,
        after: number
    ): Promise<ProcessedChatMessageWithRawMessage[]> {
        const resolvedBefore = Math.max(0, Math.min(200, Math.floor(before)));
        const resolvedAfter = Math.max(0, Math.min(200, Math.floor(after)));

        const target = await this.db.get<ProcessedChatMessageWithRawMessage>(
            `SELECT * FROM chat_messages WHERE msgId = ? AND groupId = ?`,
            [msgId, groupId]
        );
        if (!target) {
            return [];
        }

        const [beforeRows, afterRows] = await Promise.all([
            resolvedBefore === 0
                ? Promise.resolve([])
                : this.db.all<ProcessedChatMessageWithRawMessage>(
                      `SELECT * FROM chat_messages WHERE groupId = ? AND timestamp < ? ORDER BY timestamp DESC LIMIT ?`,
                      [groupId, target.timestamp, resolvedBefore]
                  ),
            resolvedAfter === 0
                ? Promise.resolve([])
                : this.db.all<ProcessedChatMessageWithRawMessage>(
                      `SELECT * FROM chat_messages WHERE groupId = ? AND timestamp > ? ORDER BY timestamp ASC LIMIT ?`,
                      [groupId, target.timestamp, resolvedAfter]
                  )
        ]);

        const combined = [...beforeRows.reverse(), target, ...afterRows];
        return combined;
    }

    // 获取所有消息，用于数据库迁移、导出、备份等操作
    public async selectAll(): Promise<ProcessedChatMessageWithRawMessage[]> {
        const res = await this.db.all<ProcessedChatMessageWithRawMessage>(`SELECT * FROM chat_messages`);
        this.LOGGER.info(`去重前消息数量: ${res.length}`);
        // 按照id进行去重
        const uniqueResMap = new Map<string, ProcessedChatMessageWithRawMessage>();
        (await res).forEach(item => {
            uniqueResMap.set(item.msgId, item);
        });
        const dedupedArr = Array.from(uniqueResMap.values());
        this.LOGGER.info(`去重后消息数量: ${dedupedArr.length}`);
        return dedupedArr;
    }

    public execQuerySQL(sql: string, params: any[] = []): Promise<any[]> {
        return this.db.all(sql, params);
    }

    /**
     * 获取多个群组在指定时间范围内的每小时消息统计
     * @param groupIds 群组ID数组
     * @param timeStart 起始时间戳（整点对齐）
     * @param timeEnd 结束时间戳
     * @returns 每小时消息数量统计 { groupId: string; hourTimestamp: number; count: number }[]
     */
    public async getMessageHourlyStatsByGroupIds(
        groupIds: string[],
        timeStart: number,
        timeEnd: number
    ): Promise<{ groupId: string; hourTimestamp: number; count: number }[]> {
        if (groupIds.length === 0) {
            return [];
        }

        // 构建 IN 子句占位符
        const placeholders = groupIds.map(() => "?").join(", ");

        // 使用 SQL 进行小时级别聚合统计
        // hourTimestamp 为每小时的起始时间戳（整点对齐）
        const sql = `
            SELECT 
                groupId,
                (timestamp / 3600000) * 3600000 AS hourTimestamp,
                COUNT(*) AS count
            FROM chat_messages 
            WHERE groupId IN (${placeholders}) 
                AND timestamp >= ? 
                AND timestamp < ?
            GROUP BY groupId, hourTimestamp
            ORDER BY groupId, hourTimestamp
        `;

        const params = [...groupIds, timeStart, timeEnd];

        const results = await this.db.all<{
            groupId: string;
            hourTimestamp: number;
            count: number;
        }>(sql, params);

        return results;
    }

    public async storeProcessedChatMessage(message: ProcessedChatMessage) {
        // 执行这个函数的时候，数据库内已经通过storeRawChatMessage函数存储了原始消息，这里只需要更新原记录中的sessionId和preProcessedContent字段即可
        await this.db.run(`UPDATE chat_messages SET sessionId = ?, preProcessedContent = ? WHERE msgId = ?`, [
            message.sessionId,
            message.preProcessedContent,
            message.msgId
        ]);
    }

    public async storeProcessedChatMessages(messages: ProcessedChatMessage[]) {
        if (messages.length === 0) return;

        await this.db.run("BEGIN IMMEDIATE TRANSACTION");
        try {
            for (const msg of messages) {
                await this.db.run(
                    `UPDATE chat_messages SET sessionId = ?, preProcessedContent = ? WHERE msgId = ?`,
                    [msg.sessionId, msg.preProcessedContent, msg.msgId]
                );
            }
            await this.db.run("COMMIT");
        } catch (err) {
            await this.db.run("ROLLBACK");
            throw err;
        }
    }
}
