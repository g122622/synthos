import Logger from "../util/Logger";
import {
    Report,
    ReportDBRecord,
    ReportType,
    dbRecordToReport,
    reportToDBRecord
} from "../contracts/report/index";
import { Disposable } from "../util/lifecycle/Disposable";
import { mustInitBeforeUse } from "../util/lifecycle/mustInitBeforeUse";
import { CommonDBService } from "./CommonDBService";
import { createReportTableSQL } from "./constants/InitialSQL";

@mustInitBeforeUse
export class ReportDBManager extends Disposable {
    private LOGGER = Logger.withTag("ReportDBManager");
    private db: CommonDBService;

    public async init() {
        this.db = new CommonDBService(createReportTableSQL);
        this._registerDisposable(this.db);
        await this.db.init();
    }

    /**
     * 存储日报
     */
    public async storeReport(report: Report): Promise<void> {
        const record = reportToDBRecord(report);
        await this.db.run(
            `INSERT INTO reports (reportId, type, timeStart, timeEnd, isEmpty, summary, summaryGeneratedAt, summaryStatus, model, statisticsJson, topicIdsJson, createdAt, updatedAt) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(reportId) DO UPDATE SET
                type = excluded.type,
                timeStart = excluded.timeStart,
                timeEnd = excluded.timeEnd,
                isEmpty = excluded.isEmpty,
                summary = excluded.summary,
                summaryGeneratedAt = excluded.summaryGeneratedAt,
                summaryStatus = excluded.summaryStatus,
                model = excluded.model,
                statisticsJson = excluded.statisticsJson,
                topicIdsJson = excluded.topicIdsJson,
                updatedAt = excluded.updatedAt
            `,
            [
                record.reportId,
                record.type,
                record.timeStart,
                record.timeEnd,
                record.isEmpty,
                record.summary,
                record.summaryGeneratedAt,
                record.summaryStatus,
                record.model,
                record.statisticsJson,
                record.topicIdsJson,
                record.createdAt,
                record.updatedAt
            ]
        );
    }

    /**
     * 根据 reportId 获取日报
     */
    public async getReportById(reportId: string): Promise<Report | null> {
        const record = await this.db.get<ReportDBRecord>(
            `SELECT * FROM reports WHERE reportId = ?`,
            [reportId]
        );
        return record ? dbRecordToReport(record) : null;
    }

    /**
     * 根据类型和时间范围获取日报列表
     */
    public async getReportsByTypeAndTimeRange(
        type: ReportType,
        timeStart: number,
        timeEnd: number
    ): Promise<Report[]> {
        const records = await this.db.all<ReportDBRecord>(
            `SELECT * FROM reports WHERE type = ? AND timeStart >= ? AND timeEnd <= ? ORDER BY timeStart DESC`,
            [type, timeStart, timeEnd]
        );
        return records.map(dbRecordToReport);
    }

    /**
     * 根据类型获取最近的日报列表
     */
    public async getRecentReportsByType(type: ReportType, limit: number): Promise<Report[]> {
        const records = await this.db.all<ReportDBRecord>(
            `SELECT * FROM reports WHERE type = ? ORDER BY timeEnd DESC LIMIT ?`,
            [type, limit]
        );
        return records.map(dbRecordToReport);
    }

    /**
     * 获取指定时间范围内的所有日报（不限类型）
     */
    public async getReportsByTimeRange(timeStart: number, timeEnd: number): Promise<Report[]> {
        const records = await this.db.all<ReportDBRecord>(
            `SELECT * FROM reports WHERE timeStart >= ? AND timeEnd <= ? ORDER BY timeStart DESC`,
            [timeStart, timeEnd]
        );
        return records.map(dbRecordToReport);
    }

    /**
     * 获取指定日期的半日报（用于日历视图）
     */
    public async getHalfDailyReportsByDate(date: Date): Promise<Report[]> {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const records = await this.db.all<ReportDBRecord>(
            `SELECT * FROM reports WHERE type = 'half-daily' AND timeStart >= ? AND timeEnd <= ? ORDER BY timeStart ASC`,
            [startOfDay.getTime(), endOfDay.getTime()]
        );
        return records.map(dbRecordToReport);
    }

    /**
     * 检查指定时间范围和类型的日报是否已存在
     */
    public async isReportExists(
        type: ReportType,
        timeStart: number,
        timeEnd: number
    ): Promise<boolean> {
        const result = await this.db.get<{ count: number }>(
            `SELECT COUNT(*) as count FROM reports WHERE type = ? AND timeStart = ? AND timeEnd = ?`,
            [type, timeStart, timeEnd]
        );
        return (result?.count ?? 0) > 0;
    }

    /**
     * 更新日报的综述信息
     */
    public async updateReportSummary(
        reportId: string,
        summary: string,
        summaryStatus: "success" | "failed",
        model: string
    ): Promise<void> {
        await this.db.run(
            `UPDATE reports SET summary = ?, summaryGeneratedAt = ?, summaryStatus = ?, model = ?, updatedAt = ? WHERE reportId = ?`,
            [summary, Date.now(), summaryStatus, model, Date.now(), reportId]
        );
    }

    /**
     * 删除日报
     */
    public async deleteReport(reportId: string): Promise<void> {
        await this.db.run(`DELETE FROM reports WHERE reportId = ?`, [reportId]);
    }

    /**
     * 获取所有日报（用于数据库迁移、导出、备份等操作）
     */
    public async selectAll(): Promise<Report[]> {
        const records = await this.db.all<ReportDBRecord>(
            `SELECT * FROM reports ORDER BY createdAt DESC`
        );
        return records.map(dbRecordToReport);
    }

    /**
     * 分页获取日报列表
     */
    public async getReportsPaginated(
        page: number,
        pageSize: number,
        type?: ReportType
    ): Promise<{ reports: Report[]; total: number }> {
        const offset = (page - 1) * pageSize;

        let countSql = `SELECT COUNT(*) as count FROM reports`;
        let selectSql = `SELECT * FROM reports`;
        const params: any[] = [];

        if (type) {
            countSql += ` WHERE type = ?`;
            selectSql += ` WHERE type = ?`;
            params.push(type);
        }

        selectSql += ` ORDER BY timeEnd DESC LIMIT ? OFFSET ?`;

        const countResult = await this.db.get<{ count: number }>(countSql, type ? [type] : []);
        const records = await this.db.all<ReportDBRecord>(selectSql, [...params, pageSize, offset]);

        return {
            reports: records.map(dbRecordToReport),
            total: countResult?.count ?? 0
        };
    }
}
