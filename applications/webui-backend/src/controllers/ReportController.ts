/**
 * 日报控制器
 */
import { Request, Response } from "express";
import { injectable, inject } from "tsyringe";
import { TOKENS } from "../di/tokens";
import { ReportService } from "../services/ReportService";
import {
    GetReportByIdSchema,
    GetReportsPaginatedSchema,
    GetReportsByDateSchema,
    GetReportsByTimeRangeSchema,
    GetRecentReportsSchema,
    TriggerReportGenerateSchema
} from "../schemas/index";

@injectable()
export class ReportController {
    constructor(
        @inject(TOKENS.ReportService) private reportService: ReportService
    ) {}

    /**
     * GET /api/report/:reportId
     * 获取单个日报详情
     */
    public async getReportById(req: Request, res: Response): Promise<void> {
        const params = GetReportByIdSchema.parse(req.params);
        const report = await this.reportService.getReportById(params.reportId);
        res.json({ success: true, data: report });
    }

    /**
     * POST /api/reports
     * 获取日报列表（分页）
     */
    public async getReportsPaginated(req: Request, res: Response): Promise<void> {
        const params = GetReportsPaginatedSchema.parse(req.body);
        const result = await this.reportService.getReportsPaginated(
            params.page,
            params.pageSize,
            params.type
        );
        res.json({ success: true, data: result });
    }

    /**
     * POST /api/reports/by-date
     * 获取指定日期的半日报
     */
    public async getReportsByDate(req: Request, res: Response): Promise<void> {
        const params = GetReportsByDateSchema.parse(req.body);
        const date = new Date(params.date);
        const reports = await this.reportService.getHalfDailyReportsByDate(date);
        res.json({ success: true, data: reports });
    }

    /**
     * POST /api/reports/by-time-range
     * 获取指定时间范围内的日报
     */
    public async getReportsByTimeRange(req: Request, res: Response): Promise<void> {
        const params = GetReportsByTimeRangeSchema.parse(req.body);
        const reports = await this.reportService.getReportsByTimeRange(
            params.timeStart,
            params.timeEnd,
            params.type
        );
        res.json({ success: true, data: reports });
    }

    /**
     * POST /api/reports/recent
     * 获取最近的日报
     */
    public async getRecentReports(req: Request, res: Response): Promise<void> {
        const params = GetRecentReportsSchema.parse(req.body);
        const reports = await this.reportService.getRecentReports(params.type, params.limit);
        res.json({ success: true, data: reports });
    }

    /**
     * POST /api/reports/generate
     * 手动触发生成日报
     */
    public async triggerGenerate(req: Request, res: Response): Promise<void> {
        const params = TriggerReportGenerateSchema.parse(req.body);
        const result = await this.reportService.triggerGenerate(
            params.type,
            params.timeStart,
            params.timeEnd
        );
        res.json({ success: true, data: result });
    }
}
