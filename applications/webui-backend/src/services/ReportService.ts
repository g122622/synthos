/**
 * 日报服务
 */
import { injectable, inject } from "tsyringe";
import { TOKENS } from "../di/tokens";
import { AgcDbAccessService } from "@root/common/services/database/AgcDbAccessService";
import { ReportDbAccessService } from "@root/common/services/database/ReportDbAccessService";
import { Report, ReportType } from "@root/common/contracts/report/index";
import { NotFoundError } from "../errors/AppError";
import { RAGClient } from "../rpc/aiModelClient";
import { ReportReadStatusManager } from "../repositories/ReportReadStatusManager";
import type { ReferenceItem } from "@root/common/rpc/ai-model";

@injectable()
export class ReportService {
    constructor(
        @inject(TOKENS.ReportDbAccessService) private reportDbAccessService: ReportDbAccessService,
        @inject(TOKENS.AgcDbAccessService) private agcDbAccessService: AgcDbAccessService,
        @inject(TOKENS.RAGClient) private ragClient: RAGClient,
        @inject(TOKENS.ReportReadStatusManager) private readStatusManager: ReportReadStatusManager
    ) {}

    /**
     * 根据 reportId 获取日报
     */
    public async getReportById(reportId: string): Promise<Report> {
        const report = await this.reportDbAccessService.getReportById(reportId);
        if (!report) {
            throw new NotFoundError("未找到对应的日报");
        }
        return report;
    }

    /**
     * 获取日报详情（包含 references）
     * references 的顺序与 report.topicIds 保持一致，从而与 AI 输出的 [话题N] 标注序号对齐。
     */
    public async getReportDetailById(reportId: string): Promise<{ report: Report; references: ReferenceItem[] }> {
        const report = await this.getReportById(reportId);

        const topicIds = report.topicIds;
        if (topicIds.length === 0) {
            return { report, references: [] };
        }

        const references: ReferenceItem[] = [];

        for (let i = 0; i < topicIds.length; i += 1) {
            const topicId = topicIds[i];
            const digest = await this.agcDbAccessService.getAIDigestResultByTopicId(topicId);

            if (!digest) {
                throw new NotFoundError(`未找到对应的话题摘要：${topicId}`);
            }

            // report 的 topicIds 已按“价值/兴趣度”排序，relevance 用序位做一个 0~1 的衰减映射。
            // 仅用于 UI 展示，并不参与检索。
            const relevance = (topicIds.length - i) / topicIds.length;

            references.push({
                topicId,
                topic: digest.topic,
                relevance
            });
        }

        return { report, references };
    }

    /**
     * 获取日报列表（分页）
     */
    public async getReportsPaginated(
        page: number,
        pageSize: number,
        type?: ReportType
    ): Promise<{ reports: Report[]; total: number; page: number; pageSize: number }> {
        const result = await this.reportDbAccessService.getReportsPaginated(page, pageSize, type);
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
        return this.reportDbAccessService.getHalfDailyReportsByDate(date);
    }

    /**
     * 获取指定时间范围内的日报
     */
    public async getReportsByTimeRange(timeStart: number, timeEnd: number, type?: ReportType): Promise<Report[]> {
        if (type) {
            return this.reportDbAccessService.getReportsByTypeAndTimeRange(type, timeStart, timeEnd);
        }
        return this.reportDbAccessService.getReportsByTimeRange(timeStart, timeEnd);
    }

    /**
     * 获取最近的日报
     */
    public async getRecentReports(type: ReportType, limit: number): Promise<Report[]> {
        return this.reportDbAccessService.getRecentReportsByType(type, limit);
    }

    /**
     * 手动触发生成日报
     * @param type 日报类型
     * @param timeStart 可选的开始时间
     * @param timeEnd 可选的结束时间
     */
    public async triggerGenerate(
        type: ReportType,
        timeStart?: number,
        timeEnd?: number
    ): Promise<{ success?: boolean; message?: string; reportId?: string }> {
        return this.ragClient.triggerReportGenerate.mutate({
            type,
            timeStart,
            timeEnd
        });
    }

    // ==================== 已读相关 ====================

    /**
     * 标记日报为已读
     */
    public async markAsRead(reportId: string): Promise<void> {
        await this.readStatusManager.markAsRead(reportId);
    }

    /**
     * 标记日报为未读
     */
    public async markAsUnread(reportId: string): Promise<void> {
        await this.readStatusManager.markAsUnread(reportId);
    }

    /**
     * 批量检查日报已读状态
     */
    public async checkReadStatus(reportIds: string[]): Promise<Record<string, boolean>> {
        const readStatus: Record<string, boolean> = {};
        for (const reportId of reportIds) {
            readStatus[reportId] = await this.readStatusManager.isReportRead(reportId);
        }
        return readStatus;
    }

    /**
     * 发送日报邮件
     * 通过 RPC 调用 ai-model 发送日报邮件
     * @param reportId 日报 ID
     * @returns 发送结果
     */
    public async sendReportEmail(reportId: string): Promise<{ success: boolean; message: string }> {
        const result = await this.ragClient.sendReportEmail.mutate({ reportId });
        return {
            success: result.success ?? false,
            message: result.message ?? ""
        };
    }
}
