import "reflect-metadata";
import { injectable, container } from "tsyringe";

import Logger from "../../util/Logger";
import { AIDigestResult } from "../../contracts/ai-model";
import { Disposable } from "../../util/lifecycle/Disposable";
import { mustInitBeforeUse } from "../../util/lifecycle/mustInitBeforeUse";
import { COMMON_TOKENS } from "../../di/tokens";

import { CommonDBService } from "./infra/CommonDBService";
import { createAGCTableSQL } from "./constants/InitialSQL";

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

        // 迁移：添加 hasEmbedding 列（如不存在）
        const columns = await this.db.all(`PRAGMA table_info(ai_digest_results)`);
        const hasHasEmbedding = columns.some((col: any) => col.name === "hasEmbedding");

        if (!hasHasEmbedding) {
            await this.db.run(`ALTER TABLE ai_digest_results ADD COLUMN hasEmbedding INTEGER NOT NULL DEFAULT 0`);
            this.LOGGER.info("已为 ai_digest_results 表补齐 hasEmbedding 字段");
        }
    }

    /**
     * 存储一个摘要结果
     * @param result 摘要结果
     */
    public async storeAIDigestResult(result: AIDigestResult) {
        await this.db.run(
            `INSERT INTO ai_digest_results (topicId, sessionId, topic, contributors, detail, modelName, updateTime, hasEmbedding) VALUES (?,?,?,?,?,?,?,?)
            ON CONFLICT(topicId) DO UPDATE SET
                sessionId = excluded.sessionId,
                topic = excluded.topic,
                contributors = excluded.contributors,
                detail = excluded.detail,
                modelName = excluded.modelName,
                updateTime = excluded.updateTime,
                hasEmbedding = CASE WHEN hasEmbedding = 1 THEN 1 ELSE excluded.hasEmbedding END
            `,
            [
                result.topicId,
                result.sessionId,
                result.topic,
                result.contributors,
                result.detail,
                result.modelName,
                result.updateTime,
                result.hasEmbedding ? 1 : 0
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
     * 更新一个sessionId的摘要结果。会先删除该sessionId对应的所有摘要结果（topics），然后再插入新的摘要结果
     * @param sessionId 会话id
     * @param results 摘要结果
     */
    public async updateAIDigestResultBySessionId(sessionId: string, results: AIDigestResult[]): Promise<void> {
        // 1. 防御性检查：results中所有result的sessionId都必须是指定的sessionId
        for (const result of results) {
            if (result.sessionId !== sessionId) {
                throw new Error(`result的sessionId必须是${sessionId}，但实际为${result.sessionId}`);
            }
        }

        // 2. 删除该sessionId对应的所有摘要结果（topics）
        await this.db.run(`DELETE FROM ai_digest_results WHERE sessionId = ?`, [sessionId]);

        // 3. 插入新的摘要结果
        await this.storeAIDigestResults(results);
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

    // 获取数据消息，用于数据库迁移、导出、备份等操作
    public async selectAll(): Promise<AIDigestResult[]> {
        return this.db.all<AIDigestResult>(`SELECT * FROM ai_digest_results`);
    }

    /**
     * 获取所有未生成嵌入向量的摘要结果
     * @returns hasEmbedding = 0 的 AIDigestResult 数组
     */
    public async getAIDigestResultsWithoutEmbedding(): Promise<AIDigestResult[]> {
        return this.db.all<AIDigestResult>(`SELECT * FROM ai_digest_results WHERE hasEmbedding = 0`);
    }

    /**
     * 将指定 topicId 标记为已生成嵌入向量
     * @param topicIds 已生成嵌入向量的 topicId 数组
     */
    public async markEmbeddingGenerated(topicIds: string[]): Promise<void> {
        if (topicIds.length === 0) return;
        const BATCH_SIZE = 500;

        for (let i = 0; i < topicIds.length; i += BATCH_SIZE) {
            const batch = topicIds.slice(i, i + BATCH_SIZE);
            const placeholders = batch.map(() => "?").join(",");

            await this.db.run(
                `UPDATE ai_digest_results SET hasEmbedding = 1 WHERE topicId IN (${placeholders})`,
                batch
            );
        }
    }
}
