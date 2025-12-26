import Logger from "../util/Logger";
import { CommonDBService } from "./CommonDBService";
import { Disposable } from "../util/lifecycle/Disposable";
import { mustInitBeforeUse } from "../util/lifecycle/mustInitBeforeUse";
import { createInterestScoreTableSQL } from "./constants/InitialSQL";

@mustInitBeforeUse
export class InterestScoreDBManager extends Disposable {
    private LOGGER = Logger.withTag("InterestScoreDBManager");
    private db: CommonDBService;

    public async init() {
        this.db = new CommonDBService(createInterestScoreTableSQL);
        this._registerDisposable(this.db);
        await this.db.init();
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

    // 如果对应的topicid不存在 或者 topicid存在但是没有对应的分数，那么该项目对应的score为null
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
        return result[Object.keys(result)[0]] === 1;
    }

    // 获取所有数据，用于数据库迁移、导出、备份等操作
    public async selectAll(): Promise<{ topicId: string; scoreV1: number | null }[]> {
        return this.db.all<{ topicId: string; scoreV1: number | null }>(
            `SELECT * FROM interset_score_results`
        );
    }
}
