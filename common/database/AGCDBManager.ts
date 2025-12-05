import ConfigManagerService from "../config/ConfigManagerService";
import Logger from "../util/Logger";
import { MultiFileSQLite } from "./MultiFileSQLite";
import { AIDigestResult } from "../types/ai-model";
import { Disposable } from "../util/lifecycle/Disposable";
import { mustInitBeforeUse } from "../util/lifecycle/mustInitBeforeUse";

@mustInitBeforeUse
export class AGCDBManager extends Disposable {
    private LOGGER = Logger.withTag("AGCDBManager");
    private db: MultiFileSQLite;

    public async init() {
        this.db = new MultiFileSQLite({
            dbBasePath: (await ConfigManagerService.getCurrentConfig()).commonDatabase.dbBasePath,
            maxDBDuration: (await ConfigManagerService.getCurrentConfig()).commonDatabase
                .maxDBDuration,
            // 一个sessionId会对应多个topicId
            initialSQL: `
                CREATE TABLE IF NOT EXISTS ai_digest_results (
                    topicId TEXT NOT NULL PRIMARY KEY,
                    sessionId TEXT,
                    topic TEXT,
                    contributors TEXT,
                    detail TEXT
                );`
        });
        this._registerDisposable(this.db);
    }

    public async storeAIDigestResult(result: AIDigestResult) {
        // to fix
        await this.db.run(
            `INSERT INTO ai_digest_results (topicId, sessionId, topic, contributors, detail) VALUES (?,?,?,?,?)
            ON CONFLICT(topicId) DO UPDATE SET
                sessionId = excluded.sessionId,
                topic = excluded.topic,
                contributors = excluded.contributors,
                detail = excluded.detail
            `,
            [result.topicId, result.sessionId, result.topic, result.contributors, result.detail]
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
        return result === 1;
    }
}
