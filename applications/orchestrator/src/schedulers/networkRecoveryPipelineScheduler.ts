import Logger from "@root/common/util/Logger";
import { checkConnectivity } from "@root/common/util/network/checkConnectivity";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { TaskHandlerTypes } from "@root/common/scheduler/@types/Tasks";

const NETWORK_RECOVERY_LOGGER = Logger.withTag("🌐 [orchestrator] [NetworkRecoveryPipelineScheduler]");

const CONNECTIVITY_CHECK_INTERVAL_MS = 30 * 1000;
const CONNECTIVITY_CHECK_TIMEOUT_MS = 3000;

/**
 * 监听网络恢复，并在网络问题导致 Pipeline 暂缓后立即补跑。
 */
export class NetworkRecoveryPipelineScheduler {
    private LOGGER = NETWORK_RECOVERY_LOGGER;
    private lastConnectivityState: boolean | null = null;
    private hasPipelineMissedDueToNetwork: boolean = false;
    private timer: ReturnType<typeof setInterval> | null = null;
    private isCheckingConnectivity: boolean = false;

    /**
     * 启动网络恢复监听。
     */
    public start(): void {
        if (this.timer) {
            return;
        }

        this.LOGGER.info(`启动网络恢复监听，检查间隔: ${CONNECTIVITY_CHECK_INTERVAL_MS}ms`);
        void this._checkAndHandleConnectivity();
        this.timer = setInterval(() => {
            void this._checkAndHandleConnectivity();
        }, CONNECTIVITY_CHECK_INTERVAL_MS);
    }

    /**
     * Pipeline 执行前检查网络；离线时记录待补跑并跳过本次执行。
     * @returns 当前是否应因网络离线跳过 Pipeline
     */
    public async shouldSkipPipelineDueToNetwork(): Promise<boolean> {
        const online = await checkConnectivity(CONNECTIVITY_CHECK_TIMEOUT_MS);

        this.lastConnectivityState = online;

        if (!online) {
            this.hasPipelineMissedDueToNetwork = true;
            this.LOGGER.warning("当前网络不可用，本次 Pipeline 暂缓；网络恢复后将立即补跑");

            return true;
        }

        return false;
    }

    /**
     * 标记已经完成一次网络补跑需求。
     */
    public markPipelineRan(): void {
        this.hasPipelineMissedDueToNetwork = false;
    }

    /**
     * 停止网络恢复监听。
     */
    public stop(): void {
        if (!this.timer) {
            return;
        }

        clearInterval(this.timer);
        this.timer = null;
    }

    private async _checkAndHandleConnectivity(): Promise<void> {
        if (this.isCheckingConnectivity) {
            return;
        }

        this.isCheckingConnectivity = true;

        try {
            const online = await checkConnectivity(CONNECTIVITY_CHECK_TIMEOUT_MS);
            const previousState = this.lastConnectivityState;

            this.lastConnectivityState = online;

            if (!online) {
                if (previousState !== false) {
                    this.LOGGER.warning("检测到网络不可用，后续恢复时将立即补跑 Pipeline");
                }
                this.hasPipelineMissedDueToNetwork = true;

                return;
            }

            if (previousState === false && this.hasPipelineMissedDueToNetwork) {
                this.LOGGER.success("检测到网络已恢复，准备立即补跑 Pipeline");
                await this._scheduleRecoveryPipeline();
            }
        } catch (error) {
            this.LOGGER.error(`网络恢复监听失败: ${error}`);
        } finally {
            this.isCheckingConnectivity = false;
        }
    }

    private async _scheduleRecoveryPipeline(): Promise<void> {
        if (await this._hasActivePipelineJob()) {
            this.LOGGER.info("已有 Pipeline 正在运行或等待执行，本次网络恢复不重复调度");

            return;
        }

        await agendaInstance.now(TaskHandlerTypes.RunPipeline, {
            ignoreActiveSessionGrace: true
        });
        this.hasPipelineMissedDueToNetwork = false;
        this.LOGGER.success("已提交网络恢复后的 Pipeline 补跑任务，本次将允许摘要最新活跃 session");
    }

    private async _hasActivePipelineJob(): Promise<boolean> {
        const jobs = await agendaInstance.jobs({ name: TaskHandlerTypes.RunPipeline });
        const now = Date.now();

        return jobs.some(job => {
            const attrs = job.attrs;

            if (attrs.lockedAt) {
                return true;
            }

            if (attrs.repeatInterval) {
                return false;
            }

            if (!attrs.nextRunAt) {
                return false;
            }

            return attrs.nextRunAt.getTime() <= now + CONNECTIVITY_CHECK_INTERVAL_MS;
        });
    }
}
