import ConfigManagerService from "../config/ConfigManagerService";
import Logger from "../util/Logger";
import { MultiFileSQLite } from "./MultiFileSQLite";

export class InterestScoreDBManager {
    private LOGGER = Logger.withTag("InterestScoreDBManager");
    private db: MultiFileSQLite;

    public async init() {
        this.db = new MultiFileSQLite({
            dbBasePath: (await ConfigManagerService.getCurrentConfig()).commonDatabase.dbBasePath,
            maxDBDuration: (await ConfigManagerService.getCurrentConfig()).commonDatabase
                .maxDBDuration,
            initialSQL: `
                CREATE TABLE IF NOT EXISTS interset_score_results (
                    topicId TEXT NOT NULL PRIMARY KEY,
                    scoreV1 REAL
                );`
        });
        this.LOGGER.info("初始化完成！");
    }

    public async storeInterestScoreResult(topicId: string, score: number, version: number = 1) {
        await this.db.run(
            `INSERT INTO interset_score_results (topicId, scoreV${version}) VALUES (?,?)
            ON CONFLICT(topicId) DO UPDATE SET
                scoreV${version} = excluded.scoreV${version}
            `,
            [topicId, score]
        );
    }

    public async getInterestScoreResult(
        topicId: string,
        version: number = 1
    ): Promise<number | null> {
        const result = await this.db.get<{ scoreV1: number | null }>(
            `SELECT scoreV${version} FROM interset_score_results WHERE topicId = ?`,
            [topicId]
        );
        // TODO 由于版本号是可配置的，下面这一行的scoreVx不应该写死
        return result?.scoreV1 || null;
    }

    public async isInterestScoreResultExist(
        topicId: string,
        version: number = 1
    ): Promise<boolean> {
        // 返回结果类似 { 'EXISTS(SELECT 1 FROM interset_score_results WHERE topicId = ?)': 0 }
        const result = await this.db.get(
            `SELECT EXISTS(SELECT 1 FROM interset_score_results WHERE topicId = ? AND scoreV${version} IS NOT NULL)`,
            [topicId]
        );
        return result === 1;
    }

    public async close() {
        await this.db.close();
    }
}
