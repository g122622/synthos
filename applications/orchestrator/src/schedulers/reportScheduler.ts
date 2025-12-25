import Logger from "@root/common/util/Logger";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { TaskHandlerTypes } from "@root/common/scheduler/@types/Tasks";
import { IConfigManagerService } from "@root/common/config/ConfigManagerService";
import { ReportType } from "@root/common/contracts/report";

const LOGGER = Logger.withTag("📰 [orchestrator] [ReportScheduler]");

/**
 * 解析时间字符串为小时和分钟
 * @param timeStr 格式为 "HH:mm" 的时间字符串
 */
function parseTimeStr(timeStr: string): { hour: number; minute: number } {
    const [hour, minute] = timeStr.split(':').map(Number);
    return { hour, minute };
}

/**
 * 计算半日报的时间范围
 * @param triggerTime 触发时间
 * @param halfDailyTimes 半日报触发时间配置
 */
function calculateHalfDailyTimeRange(triggerTime: Date, halfDailyTimes: string[]): { timeStart: number; timeEnd: number } {
    const sortedTimes = [...halfDailyTimes].sort();
    const currentTimeStr = `${String(triggerTime.getHours()).padStart(2, '0')}:${String(triggerTime.getMinutes()).padStart(2, '0')}`;
    
    // 找到当前触发时间在配置中的位置
    const currentIndex = sortedTimes.findIndex(t => t === currentTimeStr || 
        parseTimeStr(t).hour === triggerTime.getHours());
    
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
 * 设置日报定时任务调度器
 * @param configManagerService 配置管理服务
 */
export async function setupReportScheduler(configManagerService: IConfigManagerService): Promise<void> {
    const config = await configManagerService.getCurrentConfig();

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
        // 使用 cron 格式：分钟 小时 * * *
        const cronExpression = `${minute} ${hour} * * *`;
        
        LOGGER.info(`📰 设置半日报定时任务: ${timeStr} (cron: ${cronExpression})`);
        
        await agendaInstance.every(cronExpression, `HalfDailyReport_${timeStr}`, {}, {
            skipImmediate: true // 不立即执行
        });
    }

    // 为每个半日报时间点定义任务处理器
    for (const timeStr of reportConfig.schedule.halfDailyTimes) {
        agendaInstance.define(`HalfDailyReport_${timeStr}`, async () => {
            const currentConfig = await configManagerService.getCurrentConfig();
            if (!currentConfig.report?.enabled) {
                LOGGER.info("日报功能未启用，跳过");
                return;
            }

            const now = new Date();
            const { timeStart, timeEnd } = calculateHalfDailyTimeRange(now, currentConfig.report.schedule.halfDailyTimes);

            LOGGER.info(`📰 触发半日报生成: ${new Date(timeStart).toLocaleString()} - ${new Date(timeEnd).toLocaleString()}`);

            await agendaInstance.now(TaskHandlerTypes.GenerateReport, {
                reportType: 'half-daily' as ReportType,
                timeStart,
                timeEnd
            });
        });
    }

    // 配置周报定时任务
    const weeklyTime = parseTimeStr(reportConfig.schedule.weeklyTime);
    const weeklyDayOfWeek = reportConfig.schedule.weeklyDayOfWeek;
    const weeklyCron = `${weeklyTime.minute} ${weeklyTime.hour} * * ${weeklyDayOfWeek}`;
    
    LOGGER.info(`📰 设置周报定时任务: 每周${weeklyDayOfWeek} ${reportConfig.schedule.weeklyTime} (cron: ${weeklyCron})`);
    
    await agendaInstance.every(weeklyCron, 'WeeklyReport', {}, {
        skipImmediate: true
    });

    agendaInstance.define('WeeklyReport', async () => {
        const currentConfig = await configManagerService.getCurrentConfig();
        if (!currentConfig.report?.enabled) {
            LOGGER.info("日报功能未启用，跳过");
            return;
        }

        const now = new Date();
        const timeEnd = now.getTime();
        // 周报覆盖过去 7 天
        const timeStart = timeEnd - 7 * 24 * 60 * 60 * 1000;

        LOGGER.info(`📰 触发周报生成: ${new Date(timeStart).toLocaleString()} - ${new Date(timeEnd).toLocaleString()}`);

        await agendaInstance.now(TaskHandlerTypes.GenerateReport, {
            reportType: 'weekly' as ReportType,
            timeStart,
            timeEnd
        });
    });

    // 配置月报定时任务
    const monthlyTime = parseTimeStr(reportConfig.schedule.monthlyTime);
    const monthlyDayOfMonth = reportConfig.schedule.monthlyDayOfMonth;
    const monthlyCron = `${monthlyTime.minute} ${monthlyTime.hour} ${monthlyDayOfMonth} * *`;
    
    LOGGER.info(`📰 设置月报定时任务: 每月${monthlyDayOfMonth}号 ${reportConfig.schedule.monthlyTime} (cron: ${monthlyCron})`);
    
    await agendaInstance.every(monthlyCron, 'MonthlyReport', {}, {
        skipImmediate: true
    });

    agendaInstance.define('MonthlyReport', async () => {
        const currentConfig = await configManagerService.getCurrentConfig();
        if (!currentConfig.report?.enabled) {
            LOGGER.info("日报功能未启用，跳过");
            return;
        }

        const now = new Date();
        const timeEnd = now.getTime();
        // 月报覆盖过去 30 天
        const timeStart = timeEnd - 30 * 24 * 60 * 60 * 1000;

        LOGGER.info(`📰 触发月报生成: ${new Date(timeStart).toLocaleString()} - ${new Date(timeEnd).toLocaleString()}`);

        await agendaInstance.now(TaskHandlerTypes.GenerateReport, {
            reportType: 'monthly' as ReportType,
            timeStart,
            timeEnd
        });
    });

    LOGGER.success("📰 日报定时任务配置完成");
}
