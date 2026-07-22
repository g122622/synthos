/**
 * Pipeline 定时调度器
 * 使用 node-cron 按 orchestrator.pipelineIntervalInMinutes 周期触发 Pipeline
 */
import cron from "node-cron";
import Logger from "@root/common/util/Logger";
import { GlobalConfig } from "@root/common/services/config/schemas/GlobalConfig";

import { PipelineRunner } from "../pipeline/PipelineRunner";

const LOGGER = Logger.withTag("🎭 [PipelineScheduler]");

/**
 * 根据间隔分钟数构造 cron 表达式
 * - 60 的整数倍：每 N 小时整点（分钟位 0，小时位每 N 小时，其余位任意）
 * - 否则：每 N 分钟（分钟位每 N 分钟，其余位任意）
 */
function buildPipelineCron(intervalMinutes: number): string {
    if (intervalMinutes % 60 === 0) {
        const hours = intervalMinutes / 60;

        return `0 */${hours} * * *`;
    }

    return `*/${intervalMinutes} * * * *`;
}

/**
 * 设置 Pipeline 定时任务
 * @param pipelineRunner Pipeline 执行器
 * @param config 全局配置
 */
export function setupPipelineScheduler(pipelineRunner: PipelineRunner, config: GlobalConfig): void {
    const intervalMinutes = config.orchestrator.pipelineIntervalInMinutes;
    const cronExpression = buildPipelineCron(intervalMinutes);

    LOGGER.info(`Pipeline 定时任务: 每 ${intervalMinutes} 分钟 (cron: ${cronExpression})`);

    cron.schedule(
        cronExpression,
        () => {
            pipelineRunner.runPipeline().catch(err => {
                LOGGER.error(`定时触发的 Pipeline 执行失败: ${err}`);
            });
        },
        {
            timezone: "Asia/Shanghai"
        }
    );
}
