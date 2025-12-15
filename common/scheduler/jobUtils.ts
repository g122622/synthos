import { agendaInstance } from "./agenda";
import { TaskHandlerTypes, TaskParamsMap } from "./@types/Tasks";
import { sleep } from "../util/promisify/sleep";
import Logger from "../util/Logger";

const LOGGER = Logger.withTag("🕗 common/scheduler/jobUtils");

/**
 * 等待指定任务名称的 Job 完成
 * 通过轮询 MongoDB 中的 Job 状态来判断任务是否完成
 *
 * @param taskName - 任务名称（TaskHandlerTypes 枚举值）
 * @param pollIntervalMs - 轮询间隔（毫秒），默认 5000ms
 * @param timeoutMs - 超时时间（毫秒），默认 30分钟
 * @returns Promise<boolean> - 任务成功完成返回 true，超时或失败返回 false
 */
export async function waitForJobCompletion(
    taskName: TaskHandlerTypes,
    pollIntervalMs: number = 5000,
    timeoutMs: number = 30 * 60 * 1000
): Promise<boolean> {
    const startTime = Date.now();

    // 首先获取任务开始时的 lastFinishedAt 快照
    const initialJobs = await agendaInstance.jobs({ name: taskName });
    const initialJob = initialJobs[0];
    const initialLastFinishedAt = initialJob?.attrs?.lastFinishedAt?.getTime() || 0;

    LOGGER.info(
        `开始等待任务 [${taskName}] 完成，轮询间隔: ${pollIntervalMs}ms，超时时间: ${timeoutMs}ms`
    );

    while (Date.now() - startTime < timeoutMs) {
        await sleep(pollIntervalMs);

        // 查询任务的最新状态
        const jobs = await agendaInstance.jobs({ name: taskName });
        const job = jobs[0];

        if (!job) {
            LOGGER.warning(`任务 [${taskName}] 不存在，继续等待...`);
            continue;
        }

        const attrs = job.attrs;

        // 检查任务是否失败
        if (attrs.failedAt) {
            const failedAtTime = attrs.failedAt.getTime();
            // 如果 failedAt 在我们开始等待之后，说明本次执行失败了
            if (failedAtTime > startTime) {
                LOGGER.error(`任务 [${taskName}] 执行失败，失败原因: ${attrs.failReason}`);
                return false;
            }
        }

        // 检查任务是否完成（lastFinishedAt 更新了）
        const currentLastFinishedAt = attrs.lastFinishedAt?.getTime() || 0;
        if (currentLastFinishedAt > initialLastFinishedAt && currentLastFinishedAt > startTime) {
            LOGGER.success(
                `任务 [${taskName}] 已完成，耗时: ${Math.round((Date.now() - startTime) / 1000)}s`
            );
            return true;
        }

        // 检查任务是否正在运行
        if (attrs.lockedAt && !attrs.lastFinishedAt) {
            LOGGER.debug(`任务 [${taskName}] 正在运行中...`);
        } else if (attrs.nextRunAt && attrs.nextRunAt.getTime() > Date.now()) {
            LOGGER.debug(`任务 [${taskName}] 等待调度，下次运行时间: ${attrs.nextRunAt}`);
        }
    }

    LOGGER.error(`任务 [${taskName}] 等待超时（${timeoutMs}ms）`);
    return false;
}

/**
 * 立即调度一个任务并等待其完成
 *
 * @param taskName - 任务名称
 * @param data - 任务参数
 * @param pollIntervalMs - 轮询间隔（毫秒）
 * @param timeoutMs - 超时时间（毫秒）
 * @returns Promise<boolean> - 任务成功完成返回 true，超时或失败返回 false
 */
export async function scheduleAndWaitForJob<T extends TaskHandlerTypes>(
    taskName: T,
    data: TaskParamsMap[T],
    pollIntervalMs: number = 5000,
    timeoutMs: number = 30 * 60 * 1000
): Promise<boolean> {
    LOGGER.info(`调度任务 [${taskName}]`);

    // 调度任务
    await agendaInstance.now(taskName, data);

    // 等待任务完成
    return waitForJobCompletion(taskName, pollIntervalMs, timeoutMs);
}

/**
 * 清理启动前残留的任务
 *
 * 当项目重启时，MongoDB 中可能存在上次运行残留的任务：
 * - 状态为 running（被锁定）的任务：上次运行中断的任务
 * - 状态为 queued（待执行）的任务：上次调度但未执行的任务
 *
 * 此函数会：
 * 1. 取消所有被锁定（正在运行）的任务
 * 2. 移除所有一次性调度（非定时）的待执行任务
 *
 * @param taskNames - 可选，指定要清理的任务名称列表；不传则清理所有任务
 */
export async function cleanupStaleJobs(taskNames?: TaskHandlerTypes[]): Promise<void> {
    LOGGER.info("🧹 开始清理启动前残留的任务...");

    const query: Record<string, unknown> = {};
    if (taskNames && taskNames.length > 0) {
        query.name = { $in: taskNames };
    }

    // 1. 查找所有被锁定的任务（上次运行中断）
    const lockedJobs = await agendaInstance.jobs({
        ...query,
        lockedAt: { $ne: null }
    });

    if (lockedJobs.length > 0) {
        LOGGER.warning(`发现 ${lockedJobs.length} 个被锁定的残留任务，正在取消...`);
        for (const job of lockedJobs) {
            LOGGER.debug(`  - 取消任务: ${job.attrs.name} (锁定于 ${job.attrs.lockedAt})`);
            // 解除锁定并标记为失败
            job.attrs.lockedAt = undefined;
            job.attrs.failedAt = new Date();
            job.attrs.failReason = "任务在启动前被清理（上次运行可能异常中断）";
            await job.save();
        }
        LOGGER.success(`已取消 ${lockedJobs.length} 个被锁定的任务`);
    }

    // 2. 查找所有一次性调度的待执行任务（repeatInterval 为空表示非定时任务）
    // 这些任务是通过 agenda.now() 或 agenda.schedule() 创建的一次性任务
    const pendingOneTimeJobs = await agendaInstance.jobs({
        ...query,
        nextRunAt: { $ne: null },
        repeatInterval: null, // 非定时任务
        lockedAt: null // 未被锁定
    });

    if (pendingOneTimeJobs.length > 0) {
        LOGGER.warning(`发现 ${pendingOneTimeJobs.length} 个待执行的一次性任务，正在移除...`);
        for (const job of pendingOneTimeJobs) {
            LOGGER.debug(`  - 移除任务: ${job.attrs.name} (计划执行于 ${job.attrs.nextRunAt})`);
            await job.remove();
        }
        LOGGER.success(`已移除 ${pendingOneTimeJobs.length} 个待执行的一次性任务`);
    }

    if (lockedJobs.length === 0 && pendingOneTimeJobs.length === 0) {
        LOGGER.info("没有发现需要清理的残留任务");
    }

    LOGGER.success("🧹 残留任务清理完成");
}
