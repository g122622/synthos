import Logger from "../util/Logger";
import { AIDigestResult } from "../contracts/ai-model";
import { Disposable } from "../util/lifecycle/Disposable";
import { mustInitBeforeUse } from "../util/lifecycle/mustInitBeforeUse";
import { CommonDBService } from "./CommonDBService";
import { createAGCTableSQL } from "./constants/InitialSQL";

@mustInitBeforeUse
export class AGCDBManager extends Disposable {
    private LOGGER = Logger.withTag("AGCDBManager");
    private db: CommonDBService;

    public async init() {
        this.db = new CommonDBService(createAGCTableSQL);
        this._registerDisposable(this.db);
        await this.db.init();
    }

    public async storeAIDigestResult(result: AIDigestResult) {
        // to fix
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
            [result.topicId, result.sessionId, result.topic, result.contributors, result.detail, result.modelName, result.updateTime]
        );
    }

    public async storeAIDigestResults(results: AIDigestResult[]) {
        for (const result of results) {
            await this.storeAIDigestResult(result);
        }
    }

    public async getAIDigestResultByTopicId(topicId: string): Promise<AIDigestResult | null> {
        const result = await this.db.get<AIDigestResult>(
            `SELECT * FROM ai_digest_results WHERE topicId =?`,
            [topicId]
        );
        return result;
    }

    public async getAIDigestResultsBySessionId(sessionId: string): Promise<AIDigestResult[]> {
        const results = await this.db.all<AIDigestResult>(
            `SELECT * FROM ai_digest_results WHERE sessionId =?`,
            [sessionId]
        );
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
        const result = await this.db.get(
            `SELECT EXISTS(SELECT 1 FROM ai_digest_results WHERE sessionId = ?)`,
            [sessionId]
        );
        return result[Object.keys(result)[0]] === 1;
    }

    // 获取数据消息，用于数据库迁移、导出、备份等操作
    public async selectAll(): Promise<AIDigestResult[]> {
        return this.db.all<AIDigestResult>(`SELECT * FROM ai_digest_results`);
    }
}
