import "reflect-metadata";
import { injectable, container } from "tsyringe";

import Logger from "../../util/Logger";
import { AIDigestResult } from "../../contracts/ai-model";
import { Disposable } from "../../util/lifecycle/Disposable";
import { mustInitBeforeUse } from "../../util/lifecycle/mustInitBeforeUse";
import { COMMON_TOKENS } from "../../di/tokens";

import { CommonDBService } from "./infra/CommonDBService";
import { createAGCTableSQL } from "./constants/InitialSQL";

export interface SessionDigestMetadata {
    sessionId: string;
    summarizedUntil: number;
    summarizedMessageCount: number;
    updatedAt: number;
}

export interface SessionDigestCoverage {
    summarizedUntil: number;
    summarizedMessageCount: number | null;
}

/**
 * AI 生成内容数据库访问服务
 * 负责 AI 摘要结果的存储和查询
 */
@injectable()
@mustInitBeforeUse
export class AgcDbAccessService extends Disposable {
    private LOGGER = Logger.withTag("AgcDbAccessService");
    private db: CommonDBService | null = null;

    /**
     * 初始化数据库服务
     */
    public async init() {
        // 从 DI 容器获取 CommonDBService 实例
        this.db = container.resolve<CommonDBService>(COMMON_TOKENS.CommonDBService);
        await this.db.init(createAGCTableSQL);
    }

    /**
     * 存储一个摘要结果
     * @param result 摘要结果
     */
    public async storeAIDigestResult(result: AIDigestResult) {
        await this.db.run(
            `INSERT INTO ai_digest_results (topicId, sessionId, topic, contributors, detail, modelName, updateTime) VALUES (?,?,?,?,?,?,?)
            ON CONFLICT(topicId) DO UPDATE SET
                sessionId = excluded.sessionId,
                topic = excluded.topic,
                contributors = excluded.contributors,
                detail = excluded.detail,
                modelName = excluded.modelName,
                updateTime = excluded.updateTime
            `,
            [
                result.topicId,
                result.sessionId,
                result.topic,
                result.contributors,
                result.detail,
                result.modelName,
                result.updateTime
            ]
        );
    }

    /**
     * 存储多个摘要结果
     * @param results 摘要结果
     */
    public async storeAIDigestResults(results: AIDigestResult[]) {
        for (const result of results) {
            await this.storeAIDigestResult(result);
        }
    }

    /**
     * 追加存储一个 session 的摘要结果，并更新该 session 已摘要的消息范围
     * @param sessionId 会话id
     * @param results 摘要结果
     * @param metadata 摘要覆盖范围
     */
    public async storeAIDigestResultsWithSessionMetadata(
        sessionId: string,
        results: AIDigestResult[],
        metadata: Omit<SessionDigestMetadata, "sessionId" | "updatedAt">
    ): Promise<void> {
        if (results.length === 0) {
            throw new Error(`session ${sessionId} 的摘要结果不能为空`);
        }

        for (const result of results) {
            if (result.sessionId !== sessionId) {
                throw new Error(`result的sessionId必须是${sessionId}，但实际为${result.sessionId}`);
            }
        }

        await this.db.run(`BEGIN IMMEDIATE TRANSACTION`);
        try {
            await this.storeAIDigestResults(results);
            await this.upsertSessionDigestMetadata(
                sessionId,
                metadata.summarizedUntil,
                metadata.summarizedMessageCount
            );
            await this.db.run(`COMMIT`);
        } catch (error) {
            await this.db.run(`ROLLBACK`);
            throw error;
        }
    }

    /**
     * 根据topicId获取一个摘要结果
     * @param topicId 主题id
     * @returns 摘要结果
     */
    public async getAIDigestResultByTopicId(topicId: string): Promise<AIDigestResult | null> {
        const result = await this.db.get<AIDigestResult>(`SELECT * FROM ai_digest_results WHERE topicId =?`, [
            topicId
        ]);

        return result;
    }

    /**
     * 根据sessionId获取多个摘要结果
     * @param sessionId 会话id
     * @returns 摘要结果
     */
    public async getAIDigestResultsBySessionId(sessionId: string): Promise<AIDigestResult[]> {
        const results = await this.db.all<AIDigestResult>(`SELECT * FROM ai_digest_results WHERE sessionId =?`, [
            sessionId
        ]);

        return results;
    }

    /**
     * 检查一个sessionId是否已经被摘要过了
     * 检查逻辑：如果给定的sessionId出现在了表的任意一行，则返回true，否则返回false
     * @param sessionId 会话id
     * @returns 是否已经被摘要过了
     */
    public async isSessionIdSummarized(sessionId: string): Promise<boolean> {
        // 返回结果类似 { 'EXISTS(SELECT 1 FROM ai_digest_results WHERE sessionId = ?)': 0 }
        const result = await this.db.get(`SELECT EXISTS(SELECT 1 FROM ai_digest_results WHERE sessionId = ?)`, [
            sessionId
        ]);

        return result[Object.keys(result)[0]] === 1;
    }

    /**
     * 获取 session 摘要覆盖范围元数据
     * @param sessionId 会话id
     * @returns 摘要覆盖范围元数据
     */
    public async getSessionDigestMetadata(sessionId: string): Promise<SessionDigestMetadata | null> {
        const result = await this.db.get<SessionDigestMetadata>(
            `SELECT * FROM ai_digest_session_metadata WHERE sessionId = ?`,
            [sessionId]
        );

        return result || null;
    }

    /**
     * 获取 session 摘要覆盖范围。老数据没有覆盖范围元数据时，用摘要生成时间兼容判断。
     * @param sessionId 会话id
     * @returns 摘要覆盖范围
     */
    public async getSessionDigestCoverage(sessionId: string): Promise<SessionDigestCoverage | null> {
        const metadata = await this.getSessionDigestMetadata(sessionId);

        if (metadata) {
            return {
                summarizedUntil: metadata.summarizedUntil,
                summarizedMessageCount: metadata.summarizedMessageCount
            };
        }

        const latestDigest = await this.db.get<{ latestUpdateTime: number | null }>(
            `SELECT MAX(updateTime) AS latestUpdateTime FROM ai_digest_results WHERE sessionId = ?`,
            [sessionId]
        );

        if (!latestDigest || latestDigest.latestUpdateTime === null) {
            return null;
        }

        return {
            summarizedUntil: latestDigest.latestUpdateTime,
            summarizedMessageCount: null
        };
    }

    /**
     * 保存 session 摘要覆盖范围元数据
     * @param sessionId 会话id
     * @param summarizedUntil 摘要覆盖到的最新消息时间戳
     * @param summarizedMessageCount 摘要覆盖的消息数量
     */
    public async upsertSessionDigestMetadata(
        sessionId: string,
        summarizedUntil: number,
        summarizedMessageCount: number
    ): Promise<void> {
        await this.db.run(
            `INSERT INTO ai_digest_session_metadata (sessionId, summarizedUntil, summarizedMessageCount, updatedAt)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(sessionId) DO UPDATE SET
                summarizedUntil = max(ai_digest_session_metadata.summarizedUntil, excluded.summarizedUntil),
                summarizedMessageCount = max(ai_digest_session_metadata.summarizedMessageCount, excluded.summarizedMessageCount),
                updatedAt = excluded.updatedAt`,
            [sessionId, summarizedUntil, summarizedMessageCount, Date.now()]
        );
    }

    /**
     * 判断当前 session 摘要是否覆盖了给定消息范围
     * @param sessionId 会话id
     * @param latestMessageTimestamp 当前 session 最新消息时间戳
     * @param messageCount 当前 session 消息数量
     * @returns 当前摘要是否仍然有效
     */
    public async isSessionDigestFresh(
        sessionId: string,
        latestMessageTimestamp: number,
        messageCount: number
    ): Promise<boolean> {
        const coverage = await this.getSessionDigestCoverage(sessionId);

        if (!coverage) {
            return false;
        }

        if (coverage.summarizedMessageCount === null) {
            return coverage.summarizedUntil >= latestMessageTimestamp;
        }

        return (
            coverage.summarizedUntil >= latestMessageTimestamp && coverage.summarizedMessageCount >= messageCount
        );
    }

    // 获取数据消息，用于数据库迁移、导出、备份等操作
    public async selectAll(): Promise<AIDigestResult[]> {
        return this.db.all<AIDigestResult>(`SELECT * FROM ai_digest_results`);
    }
}
