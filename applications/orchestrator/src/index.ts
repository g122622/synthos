import "reflect-metadata";
import { container } from "tsyringe";
import Logger from "@root/common/util/Logger";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { TaskHandlerTypes } from "@root/common/scheduler/@types/Tasks";
import { cleanupStaleJobs } from "@root/common/scheduler/jobUtils";
import { registerConfigManagerService } from "@root/common/di/container";
import ConfigManagerService from "@root/common/services/config/ConfigManagerService";
import { COMMON_TOKENS } from "@root/common/di/tokens";
import { sleep } from "@root/common/util/promisify/sleep";
import { bootstrap, bootstrapAll } from "@root/common/util/lifecycle/bootstrap";

import { ExecutionPersistence } from "./core/ExecutionPersistence";
import { startOrchestratorRPCServer } from "./rpc/server";
import { OrchestratorRPCImpl } from "./rpc/impl";

const LOGGER = Logger.withTag("🎭 orchestrator");

@bootstrap
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class OrchestratorApplication {
    public async main(): Promise<void> {
        // 初始化 DI 容器
        registerConfigManagerService();

        const config = await ConfigManagerService.getCurrentConfig();

        // 初始化执行持久化服务
        const persistence = new ExecutionPersistence(container.resolve(COMMON_TOKENS.ConfigManagerService));

        await persistence.init();

        // 从配置读取工作流定义
        let workflows = config.orchestrator.workflows || [];

        if (workflows.length === 0) {
            LOGGER.error("❌ 配置中未找到工作流定义，请在 synthos_config.json 中配置 orchestrator.workflows");
            LOGGER.info("💡 提示：可参考项目根目录的 synthos_config.json 中的默认工作流定义");

            throw new Error("配置中未找到工作流定义");
        }

        LOGGER.info(`✅ 已加载 ${workflows.length} 个工作流定义`);

        // 清理残留任务
        await cleanupStaleJobs([
            TaskHandlerTypes.ProvideData,
            TaskHandlerTypes.Preprocess,
            TaskHandlerTypes.AISummarize,
            TaskHandlerTypes.GenerateEmbedding,
            TaskHandlerTypes.InterestScore,
            TaskHandlerTypes.LLMInterestEvaluationAndNotification,
            TaskHandlerTypes.GenerateReport
        ]);

        // 创建 RPC 实现
        const rpcImpl = new OrchestratorRPCImpl(
            container.resolve(COMMON_TOKENS.ConfigManagerService),
            persistence
        );

        // 启动 tRPC Server
        const rpcPort = config.orchestrator.rpcPort;

        startOrchestratorRPCServer(rpcImpl, rpcPort);

        await sleep(10 * 1000); // 等其他 apps 启动后再开始

        // 注册定时触发（对于主流程，按配置的 pipelineIntervalInMinutes 触发）
        const defaultWorkflow = workflows.find(wf => wf.id === "default-pipeline");

        if (defaultWorkflow) {
            const intervalMinutes = config.orchestrator.pipelineIntervalInMinutes;

            LOGGER.info(`📋 注册默认流程定时触发: 每 ${intervalMinutes} 分钟`);

            // 使用 Agenda 注册定时任务
            agendaInstance.define("TriggerDefaultWorkflow", async () => {
                LOGGER.info("⏰ 定时触发默认流程");
                await rpcImpl.triggerWorkflow({ workflowId: "default-pipeline" });
            });

            await agendaInstance.every(`${intervalMinutes} minutes`, "TriggerDefaultWorkflow");

            // 立即执行一次
            await rpcImpl.triggerWorkflow({ workflowId: "default-pipeline" });
        }

        // 注册报告定时任务
        const reportWorkflows = workflows.filter(wf => wf.id.startsWith("half-daily-report-"));

        for (const workflow of reportWorkflows) {
            const timeStr = workflow.name.match(/\((\d{2}:\d{2})\)/)?.[1];

            if (!timeStr) {
                continue;
            }

            const [hour, minute] = timeStr.split(":").map(Number);
            const cronExpression = `${minute} ${hour} * * *`;

            LOGGER.info(`📰 注册报告流程定时触发: ${workflow.name} (cron: ${cronExpression})`);

            agendaInstance.define(`TriggerWorkflow_${workflow.id}`, async () => {
                LOGGER.info(`⏰ 定时触发报告流程: ${workflow.name}`);
                await rpcImpl.triggerWorkflow({ workflowId: workflow.id });
            });

            await agendaInstance.every(
                cronExpression,
                `TriggerWorkflow_${workflow.id}`,
                {},
                { skipImmediate: true }
            );
        }

        LOGGER.success("✅ Orchestrator 准备就绪，启动 Agenda 调度器");
        await agendaInstance.start();

        LOGGER.success("🎭 Orchestrator 服务已完全启动");
    }
}

// 启动应用
bootstrapAll();
