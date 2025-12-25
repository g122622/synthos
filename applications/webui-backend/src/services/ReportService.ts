/**
 * 日报服务
 */
import { injectable, inject } from "tsyringe";
import { TOKENS } from "../di/tokens";
import { ReportDBManager } from "@root/common/database/ReportDBManager";
import { Report, ReportType } from "@root/common/contracts/report";
import { NotFoundError } from "../errors/AppError";

@injectable()
export class ReportService {
    constructor(
        @inject(TOKENS.ReportDBManager) private reportDBManager: ReportDBManager
    ) {}

    /**
     * 根据 reportId 获取日报
     */
    public async getReportById(reportId: string): Promise<Report> {
        const report = await this.reportDBManager.getReportById(reportId);
        if (!report) {
            throw new NotFoundError("未找到对应的日报");
        }
        return report;
    }

    /**
     * 获取日报列表（分页）
     */
    public async getReportsPaginated(
        page: number,
        pageSize: number,
        type?: ReportType
    ): Promise<{ reports: Report[]; total: number; page: number; pageSize: number }> {
        const result = await this.reportDBManager.getReportsPaginated(page, pageSize, type);
        return {
            ...result,
            page,
            pageSize
        };
    }

    /**
     * 获取指定日期的半日报
     */
    public async getHalfDailyReportsByDate(date: Date): Promise<Report[]> {
        return this.reportDBManager.getHalfDailyReportsByDate(date);
    }

    /**
     * 获取指定时间范围内的日报
     */
    public async getReportsByTimeRange(
        timeStart: number,
        timeEnd: number,
        type?: ReportType
    ): Promise<Report[]> {
        if (type) {
            return this.reportDBManager.getReportsByTypeAndTimeRange(type, timeStart, timeEnd);
        }
        return this.reportDBManager.getReportsByTimeRange(timeStart, timeEnd);
    }

    /**
     * 获取最近的日报
     */
    public async getRecentReports(type: ReportType, limit: number): Promise<Report[]> {
        return this.reportDBManager.getRecentReportsByType(type, limit);
    }
}
