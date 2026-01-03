/**
 * ai-model 子项目的 DI 容器管理
 * 提供子项目特有服务的注册和获取函数
 */
import "reflect-metadata";
import { container } from "tsyringe";
import { AI_MODEL_TOKENS } from "./tokens";
import ReportEmailServiceInstance, { ReportEmailService } from "../services/email/ReportEmailService";

/**
 * 初始化并注册 ReportEmailService 到 DI 容器
 * 在 ai-model 应用启动时调用
 */
export function registerReportEmailService(): void {
    container.registerInstance(AI_MODEL_TOKENS.ReportEmailService, ReportEmailServiceInstance);
}

/**
 * 从 DI 容器获取 ReportEmailService 实例
 * @returns ReportEmailService 实例
 */
export function getReportEmailService(): ReportEmailService {
    return container.resolve<ReportEmailService>(AI_MODEL_TOKENS.ReportEmailService);
}
