import "reflect-metadata";
import Logger from "@root/common/util/Logger";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { TaskHandlerTypes, TaskParameters } from "@root/common/scheduler/@types/Tasks";
import { cleanupStaleJobs, scheduleAndWaitForJob } from "@root/common/scheduler/jobUtils";
import { registerConfigManagerService, getConfigManagerService } from "@root/common/di/container";
import { getHoursAgoTimestamp } from "@root/common/util/TimeUtils";
import { IMTypes } from "@root/common/contracts/data-provider/index";
import { sleep } from "@root/common/util/promisify/sleep";

/**
 * Pipeline 执行顺序（严格串行）:
 * 1. ProvideData - 获取原始数据
 * 2. Preprocess - 预处理数据
 * 3. AISummarize - AI 摘要生成
 * 4. GenerateEmbedding - 生成向量嵌入
 * 5. InterestScore - 计算兴趣度评分
 */

(async () => {
    // 初始化 DI 容器
    registerConfigManagerService();
    const configManagerService = getConfigManagerService();

    const LOGGER = Logger.withTag("🎭 orchestrator-root-script");

    let config = await configManagerService.getCurrentConfig();

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
            const startTimeStamp = getHoursAgoTimestamp(config.orchestrator.dataSeekTimeWindowInHours);
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

    // 在启动前清理所有残留任务，避免上次运行残留的任务导致非预期执行
    await cleanupStaleJobs([
        TaskHandlerTypes.RunPipeline,
        TaskHandlerTypes.ProvideData,
        TaskHandlerTypes.Preprocess,
        TaskHandlerTypes.AISummarize,
        TaskHandlerTypes.GenerateEmbedding,
        TaskHandlerTypes.InterestScore
    ]);

    await sleep(30 * 1000); // 等其他apps启动后再开始流水线 TODO: 换成更优雅的方式

    // 读取配置，设置定时执行 Pipeline
    const pipelineIntervalMinutes = config.orchestrator?.pipelineIntervalInMinutes;
    LOGGER.debug(`Pipeline 任务将每隔 ${pipelineIntervalMinutes} 分钟执行一次`);
    await agendaInstance.every(
        pipelineIntervalMinutes + " minutes",
        TaskHandlerTypes.RunPipeline
    ); // skipImmediate默认为false，表示立即执行第一次

    LOGGER.success("✅ Orchestrator 准备就绪，启动 Agenda 调度器");
    await agendaInstance.start();
})();
