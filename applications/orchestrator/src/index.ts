import "reflect-metadata";
import Logger from "@root/common/util/Logger";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { TaskHandlerTypes, TaskParameters } from "@root/common/scheduler/@types/Tasks";
import { cleanupStaleJobs, scheduleAndWaitForJob } from "@root/common/scheduler/jobUtils";
import { registerConfigManagerService, getConfigManagerService } from "@root/common/di/container";
import { getHoursAgoTimestamp } from "@root/common/util/TimeUtils";
import { IMTypes } from "@root/common/contracts/data-provider/index";
import { ReportType } from "@root/common/contracts/report";
import { sleep } from "@root/common/util/promisify/sleep";

/**
 * Pipeline 执行顺序（严格串行）:
 * 1. ProvideData - 获取原始数据
 * 2. Preprocess - 预处理数据
 * 3. AISummarize - AI 摘要生成
 * 4. GenerateEmbedding - 生成向量嵌入
 * 5. InterestScore - 计算兴趣度评分
 */

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

(async () => {
    // 初始化 DI 容器
    registerConfigManagerService();
    const configManagerService = getConfigManagerService();

    const LOGGER = Logger.withTag("🎭 orchestrator-root-script");

    let config = await configManagerService.getCurrentConfig();

    // 在启动前清理所有残留任务，避免上次运行残留的任务导致非预期执行
    await cleanupStaleJobs([
        TaskHandlerTypes.RunPipeline,
        TaskHandlerTypes.ProvideData,
        TaskHandlerTypes.Preprocess,
        TaskHandlerTypes.AISummarize,
        TaskHandlerTypes.GenerateEmbedding,
        TaskHandlerTypes.InterestScore,
        TaskHandlerTypes.GenerateReport
    ]);

    // 定义 RunPipeline 任务
    await agendaInstance
        .create(TaskHandlerTypes.RunPipeline)
        .unique({ name: TaskHandlerTypes.RunPipeline }, { insertOnly: true })
        .save();
    agendaInstance.define<TaskParameters<TaskHandlerTypes.RunPipeline>>(
        TaskHandlerTypes.RunPipeline,
        async job => {
            LOGGER.info(`🚀 开始执行 Pipeline 任务: ${job.attrs.name}`);
            config = await configManagerService.getCurrentConfig(); // 刷新配置
            const startTimeStamp = getHoursAgoTimestamp(
                config.orchestrator.dataSeekTimeWindowInHours
            );
            const endTimeStamp = Date.now();

            const groupIds = Object.keys(config.groupConfigs);
            LOGGER.info(`Pipeline 配置 - 处理群组: ${groupIds.join(", ")}`);

            // 任务超时时间配置（毫秒）
            const TASK_TIMEOUT = 90 * 60 * 1000; // 90分钟
            const POLL_INTERVAL = 5000; // 5秒

            // ==================== 步骤 1: ProvideData ====================
            LOGGER.info("📥 [1/5] 开始执行 ProvideData 任务...");
            const provideDataSuccess = await scheduleAndWaitForJob(
                TaskHandlerTypes.ProvideData,
                {
                    IMType: IMTypes.QQ, // TODO: 支持多种 IM 类型
                    groupIds,
                    startTimeStamp,
                    endTimeStamp
                },
                POLL_INTERVAL,
                TASK_TIMEOUT
            );
            if (!provideDataSuccess) {
                LOGGER.error("❌ ProvideData 任务失败，Pipeline 终止");
                job.fail("ProvideData task failed");
                return;
            }
            await job.touch();

            // ==================== 步骤 2: Preprocess ====================
            LOGGER.info("🔧 [2/5] 开始执行 Preprocess 任务...");
            const preprocessSuccess = await scheduleAndWaitForJob(
                TaskHandlerTypes.Preprocess,
                {
                    groupIds,
                    startTimeStamp,
                    endTimeStamp
                },
                POLL_INTERVAL,
                TASK_TIMEOUT
            );
            if (!preprocessSuccess) {
                LOGGER.error("❌ Preprocess 任务失败，Pipeline 终止");
                job.fail("Preprocess task failed");
                return;
            }
            await job.touch();

            // ==================== 步骤 3: AISummarize ====================
            LOGGER.info("🤖 [3/5] 开始执行 AISummarize 任务...");
            const aiSummarizeSuccess = await scheduleAndWaitForJob(
                TaskHandlerTypes.AISummarize,
                {
                    groupIds,
                    startTimeStamp,
                    endTimeStamp
                },
                POLL_INTERVAL,
                TASK_TIMEOUT
            );
            if (!aiSummarizeSuccess) {
                LOGGER.error("❌ AISummarize 任务失败，Pipeline 终止");
                job.fail("AISummarize task failed");
                return;
            }
            await job.touch();

            // ==================== 步骤 4: GenerateEmbedding ====================
            LOGGER.info("📐 [4/5] 开始执行 GenerateEmbedding 任务...");
            const generateEmbeddingSuccess = await scheduleAndWaitForJob(
                TaskHandlerTypes.GenerateEmbedding,
                {
                    startTimeStamp,
                    endTimeStamp
                },
                POLL_INTERVAL,
                TASK_TIMEOUT
            );
            if (!generateEmbeddingSuccess) {
                LOGGER.error("❌ GenerateEmbedding 任务失败，Pipeline 终止");
                job.fail("GenerateEmbedding task failed");
                return;
            }
            await job.touch();

            // ==================== 步骤 5: InterestScore ====================
            // LOGGER.info("⭐ [5/5] 开始执行 InterestScore 任务...");
            // const interestScoreSuccess = await scheduleAndWaitForJob(
            //     TaskHandlerTypes.InterestScore,
            //     {
            //         startTimeStamp,
            //         endTimeStamp
            //     },
            //     POLL_INTERVAL,
            //     TASK_TIMEOUT
            // );
            // if (!interestScoreSuccess) {
            //     LOGGER.error("❌ InterestScore 任务失败，Pipeline 终止");
            //     job.fail("InterestScore task failed");
            //     return;
            // }

            LOGGER.success(`🎉 Pipeline 任务全部完成！`);
        },
        {
            concurrency: 1,
            priority: "high",
            lockLifetime: 90 * 60 * 1000 // 90min（Pipeline 整体超时）
        }
    );

    await sleep(30 * 1000); // 等其他apps启动后再开始流水线 TODO: 换成更优雅的方式

    // 读取配置，设置定时执行 Pipeline
    const pipelineIntervalMinutes = config.orchestrator?.pipelineIntervalInMinutes;
    LOGGER.debug(`Pipeline 任务将每隔 ${pipelineIntervalMinutes} 分钟执行一次`);
    await agendaInstance.every(pipelineIntervalMinutes + " minutes", TaskHandlerTypes.RunPipeline);
    await agendaInstance.now(TaskHandlerTypes.RunPipeline);

    LOGGER.success("✅ Orchestrator 准备就绪，启动 Agenda 调度器");
    await agendaInstance.start();

    // ==================== 日报定时任务 ====================
    // 检查日报功能是否启用
    if (config.report?.enabled) {
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
            agendaInstance.define(`HalfDailyReport_${timeStr}`, async (job) => {
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

        agendaInstance.define('WeeklyReport', async (job) => {
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

        agendaInstance.define('MonthlyReport', async (job) => {
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
    } else {
        LOGGER.info("📰 日报功能未启用");
    }
})();
