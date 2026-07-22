/**
 * 日报定时调度器
 * 使用 node-cron 按配置的半日报/周报/月报时间触发日报生成
 */
import cron from "node-cron";
import Logger from "@root/common/util/Logger";
import ConfigManagerService from "@root/common/services/config/ConfigManagerService";
import { GlobalConfig } from "@root/common/services/config/schemas/GlobalConfig";
import { ReportType } from "@root/common/contracts/report";

import { AIModelClient } from "../rpc/clients";

const LOGGER = Logger.withTag("📰 [ReportScheduler]");

/**
 * 解析时间字符串为小时和分钟
 * @param timeStr 格式为 "HH:mm" 的时间字符串
 */
function parseTimeStr(timeStr: string): { hour: number; minute: number } {
    const [hour, minute] = timeStr.split(":").map(Number);

    return { hour, minute };
}

/**
 * 计算半日报的时间范围
 * @param triggerTime 触发时间
 * @param halfDailyTimes 半日报触发时间配置
 */
function calculateHalfDailyTimeRange(
    triggerTime: Date,
    halfDailyTimes: string[]
): { timeStart: number; timeEnd: number } {
    const sortedTimes = [...halfDailyTimes].sort();
    const currentTimeStr = `${String(triggerTime.getHours()).padStart(2, "0")}:${String(triggerTime.getMinutes()).padStart(2, "0")}`;

    // 找到当前触发时间在配置中的位置
    const currentIndex = sortedTimes.findIndex(
        t => t === currentTimeStr || parseTimeStr(t).hour === triggerTime.getHours()
    );

    const timeEnd = triggerTime.getTime();
    let timeStart: number;

    if (currentIndex <= 0) {
        // 第一个时间点，从前一天最后一个时间点开始
        const lastTime = parseTimeStr(sortedTimes[sortedTimes.length - 1]);
        const startDate = new Date(triggerTime);

        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(lastTime.hour, lastTime.minute, 0, 0);
        timeStart = startDate.getTime();
    } else {
        // 从前一个时间点开始
        const prevTime = parseTimeStr(sortedTimes[currentIndex - 1]);
        const startDate = new Date(triggerTime);

        startDate.setHours(prevTime.hour, prevTime.minute, 0, 0);
        timeStart = startDate.getTime();
    }

    return { timeStart, timeEnd };
}

/**
 * 触发日报生成（运行时检查启用状态并捕获异常，避免崩溃进程）
 */
async function triggerReport(
    client: AIModelClient,
    reportType: ReportType,
    timeStart: number,
    timeEnd: number
): Promise<void> {
    try {
        const cfg = await ConfigManagerService.getCurrentConfig();

        if (!cfg.report?.enabled) {
            LOGGER.info("日报功能未启用，跳过");

            return;
        }

        LOGGER.info(
            `📰 触发 ${reportType} 生成: ${new Date(timeStart).toLocaleString()} - ${new Date(timeEnd).toLocaleString()}`
        );

        await client.generateReport.mutate({ reportType, timeStart, timeEnd });
        LOGGER.success(`📰 ${reportType} 生成完成`);
    } catch (err) {
        LOGGER.error(`📰 ${reportType} 生成失败: ${err}`);
    }
}

/**
 * 设置日报定时任务
 * @param aiModelClient ai-model 客户端
 * @param config 全局配置
 */
export function setupReportScheduler(aiModelClient: AIModelClient, config: GlobalConfig): void {
    // 检查日报功能是否启用
    if (!config.report?.enabled) {
        LOGGER.info("📰 日报功能未启用");

        return;
    }

    LOGGER.info("📰 日报功能已启用，开始配置定时任务...");

    const reportConfig = config.report;

    // 配置半日报定时任务
    for (const timeStr of reportConfig.schedule.halfDailyTimes) {
        const { hour, minute } = parseTimeStr(timeStr);
        const cronExpression = `${minute} ${hour} * * *`;

        LOGGER.info(`📰 设置半日报定时任务: ${timeStr} (cron: ${cronExpression})`);

        cron.schedule(
            cronExpression,
            () => {
                const now = new Date();
                const { timeStart, timeEnd } = calculateHalfDailyTimeRange(
                    now,
                    reportConfig.schedule.halfDailyTimes
                );

                void triggerReport(aiModelClient, "half-daily", timeStart, timeEnd);
            },
            {
                timezone: "Asia/Shanghai"
            }
        );
    }

    // 配置周报定时任务
    const weeklyTime = parseTimeStr(reportConfig.schedule.weeklyTime);
    const weeklyDayOfWeek = reportConfig.schedule.weeklyDayOfWeek;
    const weeklyCron = `${weeklyTime.minute} ${weeklyTime.hour} * * ${weeklyDayOfWeek}`;

    LOGGER.info(
        `📰 设置周报定时任务: 每周${weeklyDayOfWeek} ${reportConfig.schedule.weeklyTime} (cron: ${weeklyCron})`
    );

    cron.schedule(
        weeklyCron,
        () => {
            const now = new Date();
            const timeEnd = now.getTime();
            const timeStart = timeEnd - 7 * 24 * 60 * 60 * 1000; // 周报覆盖过去 7 天

            void triggerReport(aiModelClient, "weekly", timeStart, timeEnd);
        },
        {
            timezone: "Asia/Shanghai"
        }
    );

    // 配置月报定时任务
    const monthlyTime = parseTimeStr(reportConfig.schedule.monthlyTime);
    const monthlyDayOfMonth = reportConfig.schedule.monthlyDayOfMonth;
    const monthlyCron = `${monthlyTime.minute} ${monthlyTime.hour} ${monthlyDayOfMonth} * *`;

    LOGGER.info(
        `📰 设置月报定时任务: 每月${monthlyDayOfMonth}号 ${reportConfig.schedule.monthlyTime} (cron: ${monthlyCron})`
    );

    cron.schedule(
        monthlyCron,
        () => {
            const now = new Date();
            const timeEnd = now.getTime();
            const timeStart = timeEnd - 30 * 24 * 60 * 60 * 1000; // 月报覆盖过去 30 天

            void triggerReport(aiModelClient, "monthly", timeStart, timeEnd);
        },
        {
            timezone: "Asia/Shanghai"
        }
    );

    LOGGER.success("📰 日报定时任务配置完成");
}
