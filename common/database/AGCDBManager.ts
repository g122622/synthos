import ConfigManagerService from "../config/ConfigManagerService";
import { ProcessedChatMessage, RawChatMessage } from "../types/data-provider/index";
import Logger from "../util/Logger";
import { MultiFileSQLite } from "./MultiFileSQLite";
import { AIDigestResult } from "../types/ai-model";

export class AGCDBManager {
    private LOGGER = Logger.withTag("AGCDBManager");
    private db: MultiFileSQLite;

    public async init() {
        this.db = new MultiFileSQLite({
            dbBasePath: (await ConfigManagerService.getCurrentConfig()).commonDatabase.dbBasePath,
            maxDBDuration: (await ConfigManagerService.getCurrentConfig()).commonDatabase.maxDBDuration,
            initialSQL: `
                CREATE TABLE IF NOT EXISTS ai_digest_results (
                    topicId TEXT NOT NULL PRIMARY KEY,
                    sessionId TEXT,
                    topic TEXT,
                    contributors TEXT,
                    detail TEXT
                );`
        });
        this.LOGGER.info("初始化完成！");
    }

    public async storeAIDigestResult(result: AIDigestResult) {
        // to fix
        await this.db.run(
            `INSERT INTO ai_digest_results (sessionId, topic, contributors, detail) VALUES (?,?,?,?)
            ON CONFLICT(sessionId) DO UPDATE SET
                topic = excluded.topic,
                contributors = excluded.contributors,
                detail = excluded.detail
            `,
            [result.sessionId, result.topic, result.contributors, result.detail]
        );
    }

    public async storeAIDigestResults(results: AIDigestResult[]) {
        for (const result of results) {
            await this.storeAIDigestResult(result);
        }
    }

    public async getAIDigestResultBySessionId(sessionId: string): Promise<AIDigestResult | null> {
        const result = (await this.db.get(`SELECT * FROM ai_digest_results WHERE sessionId =?`, [
            sessionId
        ])) as AIDigestResult | null;
        return result;
    }

    public async close() {
        await this.db.close();
    }
}
