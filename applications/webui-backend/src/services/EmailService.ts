/**
 * 邮件发送服务
 */
import * as nodemailer from "nodemailer";
import { injectable, inject } from "tsyringe";
import { TOKENS } from "../di/tokens";
import Logger from "@root/common/util/Logger";
import type ConfigManagerServiceType from "@root/common/config/ConfigManagerService";
import { Report, ReportType } from "@root/common/contracts/report";

@injectable()
export class EmailService {
    private LOGGER = Logger.withTag("EmailService");
    private transporter: nodemailer.Transporter | null = null;

    constructor(
        @inject(TOKENS.ConfigManagerService) private configManagerService: typeof ConfigManagerServiceType
    ) {}

    /**
     * 初始化邮件传输器
     */
    private async initTransporter(): Promise<void> {
        const config = await this.configManagerService.getCurrentConfig();

        if (!config.report?.email?.enabled) {
            this.LOGGER.info("邮件功能未启用");
            return;
        }

        const { smtp } = config.report.email;

        this.transporter = nodemailer.createTransport({
            host: smtp.host,
            port: smtp.port,
            secure: smtp.secure,
            auth: {
                user: smtp.user,
                pass: smtp.pass
            }
        });

        // 验证连接
        try {
            await this.transporter.verify();
            this.LOGGER.success("邮件服务连接成功");
        } catch (error) {
            this.LOGGER.error(`邮件服务连接失败: ${error}`);
            this.transporter = null;
        }
    }

    /**
     * 发送日报邮件
     */
    public async sendReportEmail(report: Report): Promise<boolean> {
        const config = await this.configManagerService.getCurrentConfig();

        if (!config.report?.email?.enabled) {
            this.LOGGER.info("邮件功能未启用，跳过发送");
            return false;
        }

        if (!this.transporter) {
            await this.initTransporter();
        }

        if (!this.transporter) {
            this.LOGGER.error("邮件传输器未初始化，无法发送邮件");
            return false;
        }

        const { from, recipients, retryCount } = config.report.email;

        // 构建邮件标题
        const subject = this.buildEmailSubject(report);

        // 构建邮件内容
        const html = this.buildEmailHtml(report);

        // 重试发送
        for (let attempt = 0; attempt <= retryCount; attempt++) {
            try {
                await this.transporter.sendMail({
                    from,
                    to: recipients.join(", "),
                    subject,
                    html
                });

                this.LOGGER.success(`日报邮件发送成功: ${subject}`);
                return true;
            } catch (error) {
                this.LOGGER.warning(`第 ${attempt + 1} 次发送邮件失败: ${error}`);
                if (attempt === retryCount) {
                    this.LOGGER.error(`所有重试均失败，邮件发送失败`);
                    return false;
                }
            }
        }

        return false;
    }

    /**
     * 构建邮件标题
     */
    private buildEmailSubject(report: Report): string {
        const startDate = new Date(report.timeStart);
        const dateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;

        if (report.type === 'half-daily') {
            const period = startDate.getHours() < 12 ? '上午' : '下午';
            return `[Synthos 半日报] ${dateStr} ${period}`;
        } else if (report.type === 'weekly') {
            return `[Synthos 周报] ${dateStr}`;
        } else {
            return `[Synthos 月报] ${dateStr}`;
        }
    }

    /**
     * 构建邮件 HTML 内容
     */
    private buildEmailHtml(report: Report): string {
        const startDate = new Date(report.timeStart);
        const endDate = new Date(report.timeEnd);

        const formatDateTime = (d: Date) =>
            `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

        const reportTypeNameMap: Record<ReportType, string> = {
            'half-daily': '半日报',
            'weekly': '周报',
            'monthly': '月报'
        };
        const reportTypeName = reportTypeNameMap[report.type];

        const activeGroupsStr = report.statistics.mostActiveGroups.length > 0
            ? report.statistics.mostActiveGroups.join('、')
            : '暂无';

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
        .header h1 { margin: 0; font-size: 24px; }
        .header .period { margin-top: 10px; opacity: 0.9; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .stats { display: flex; gap: 20px; margin-bottom: 30px; flex-wrap: wrap; }
        .stat-card { background: white; padding: 20px; border-radius: 8px; flex: 1; min-width: 150px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .stat-card .label { font-size: 14px; color: #666; }
        .stat-card .value { font-size: 24px; font-weight: bold; color: #333; margin-top: 5px; }
        .summary { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .summary h2 { margin-top: 0; color: #333; font-size: 18px; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
        .summary-text { white-space: pre-wrap; color: #555; }
        .footer { margin-top: 30px; text-align: center; color: #999; font-size: 12px; }
        .empty-notice { background: #fff3cd; color: #856404; padding: 15px; border-radius: 8px; text-align: center; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📰 Synthos ${reportTypeName}</h1>
        <div class="period">
            ${formatDateTime(startDate)} - ${formatDateTime(endDate)}
        </div>
    </div>
    <div class="content">
        <div class="stats">
            <div class="stat-card">
                <div class="label">话题总数</div>
                <div class="value">${report.statistics.topicCount}</div>
            </div>
            <div class="stat-card">
                <div class="label">最活跃群组</div>
                <div class="value" style="font-size: 14px;">${activeGroupsStr}</div>
            </div>
            <div class="stat-card">
                <div class="label">最活跃时段</div>
                <div class="value">${report.statistics.mostActiveHour}:00</div>
            </div>
        </div>
        ${report.isEmpty ? `
        <div class="empty-notice">
            📭 本时段暂无热门话题讨论
        </div>
        ` : `
        <div class="summary">
            <h2>📝 综述</h2>
            <div class="summary-text">${this.escapeHtml(report.summary)}</div>
        </div>
        `}
    </div>
    <div class="footer">
        <p>此邮件由 Synthos 系统自动发送，请勿直接回复</p>
        <p>生成时间：${new Date().toLocaleString('zh-CN')}</p>
    </div>
</body>
</html>
        `;
    }

    /**
     * HTML 转义
     */
    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
            .replace(/\n/g, '<br>');
    }
}
