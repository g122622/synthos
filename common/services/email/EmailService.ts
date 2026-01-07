/**
 * 通用邮件发送服务
 * 提供基础的邮件发送能力，与具体业务逻辑无关
 */
import "reflect-metadata";
import * as nodemailer from "nodemailer";
import { injectable, inject } from "tsyringe";
import Logger from "../../util/Logger";
import { ConfigManagerService } from "../config/ConfigManagerService";
import { COMMON_TOKENS } from "../../di/tokens";

/**
 * 发送邮件的选项
 */
export interface SendEmailOptions {
    /** 邮件主题 */
    subject: string;
    /** 邮件 HTML 内容 */
    html: string;
}

/**
 * 通用邮件服务
 * 负责初始化 SMTP 连接并提供通用的邮件发送接口
 * 发件人、收件人、重试次数等配置统一从 config.email 读取
 */
@injectable()
class EmailService {
    private _logger: ReturnType<typeof Logger.withTag> | null = null;
    private transporter: nodemailer.Transporter | null = null;

    /**
     * 构造函数
     * @param configManagerService 配置管理服务
     */
    public constructor(
        @inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService
    ) {}

    /**
     * 获取 Logger 实例（懒加载，避免循环依赖）
     */
    private get LOGGER(): ReturnType<typeof Logger.withTag> {
        if (!this._logger) {
            this._logger = Logger.withTag("EmailService");
        }
        return this._logger;
    }

    /**
     * 初始化邮件传输器
     */
    private async initTransporter(): Promise<void> {
        const config = await this.configManagerService.getCurrentConfig();

        if (!config.email.enabled) {
            this.LOGGER.info("邮件功能未启用");
            return;
        }

        const { smtp } = config.email;

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
     * 检查邮件服务是否已启用
     * @returns 是否启用
     */
    public async isEnabled(): Promise<boolean> {
        const config = await this.configManagerService.getCurrentConfig();
        return config.email.enabled;
    }

    /**
     * 发送邮件（通用接口）
     * 发件人、收件人、重试次数从配置文件读取
     * @param options 发送邮件的选项（主题和内容）
     * @returns 是否发送成功
     */
    public async sendEmail(options: SendEmailOptions): Promise<boolean> {
        const config = await this.configManagerService.getCurrentConfig();

        if (!config.email.enabled) {
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

        const { from, recipients, retryCount } = config.email;
        const { subject, html } = options;

        // 带重试的发送逻辑
        for (let attempt = 0; attempt <= retryCount; attempt++) {
            try {
                await this.transporter.sendMail({
                    from,
                    to: recipients.join(", "),
                    subject,
                    html
                });

                this.LOGGER.success(`邮件发送成功: ${subject}`);
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
     * HTML 转义（公共工具方法）
     * @param text 原始文本
     * @returns 转义后的文本
     */
    public escapeHtml(text: string): string {
        const escapeMap: Record<string, string> = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;",
            "\n": "<br>"
        };

        let result = text;
        for (const [char, escaped] of Object.entries(escapeMap)) {
            result = result.split(char).join(escaped);
        }
        return result;
    }
}

/**
 * EmailService 实例类型
 * 用于依赖注入时的类型标注
 */
export type IEmailService = EmailService;

export { EmailService };
