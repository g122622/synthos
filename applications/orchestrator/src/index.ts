import "reflect-metadata";
import { container } from "tsyringe";
import Logger from "@root/common/util/Logger";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { TaskHandlerTypes } from "@root/common/scheduler/@types/Tasks";
import { cleanupStaleJobs } from "@root/common/scheduler/jobUtils";
import { registerConfigManagerService } from "@root/common/di/container";
import ConfigManagerService from "@root/common/services/config/ConfigManagerService";
import { COMMON_TOKENS } from "@root/common/di/tokens";
import { IMTypes } from "@root/common/contracts/data-provider/index";
import { sleep } from "@root/common/util/promisify/sleep";
import { bootstrap, bootstrapAll } from "@root/common/util/lifecycle/bootstrap";
import {
    WorkflowDefinition,
    WorkflowNodeType,
    WorkflowNode,
    WorkflowEdge
} from "@root/common/contracts/workflow/index";
import { getHoursAgoTimestamp } from "@root/common/util/TimeUtils";

import { ExecutionPersistence } from "./core/ExecutionPersistence";
import { startOrchestratorRPCServer } from "./rpc/server";
import { OrchestratorRPCImpl } from "./rpc/impl";

const LOGGER = Logger.withTag("🎭 orchestrator");

/**
 * 生成默认工作流定义（对标原有 6 步 Pipeline）
 * @param config 当前配置
 * @returns 默认工作流定义
 */
function generateDefaultWorkflow(config: any): WorkflowDefinition {
    const nodes: WorkflowNode[] = [
        {
            id: "start",
            type: WorkflowNodeType.Start,
            position: { x: 100, y: 100 },
            data: { label: "开始" }
        },
        {
            id: "provideData",
            type: WorkflowNodeType.Task,
            position: { x: 100, y: 200 },
            data: {
                label: "获取原始数据",
                taskType: TaskHandlerTypes.ProvideData,
                params: {
                    IMType: IMTypes.QQ,
                    groupIds: Object.keys(config.groupConfigs),
                    startTimeStamp: -1,
                    endTimeStamp: Date.now()
                },
                retryCount: 0,
                timeoutMs: 90 * 60 * 1000,
                skipOnFailure: false
            }
        },
        {
            id: "preprocess",
            type: WorkflowNodeType.Task,
            position: { x: 100, y: 300 },
            data: {
                label: "预处理数据",
                taskType: TaskHandlerTypes.Preprocess,
                params: {
                    groupIds: Object.keys(config.groupConfigs),
                    startTimeStamp: getHoursAgoTimestamp(config.orchestrator.dataSeekTimeWindowInHours),
                    endTimeStamp: Date.now()
                },
                retryCount: 0,
                timeoutMs: 90 * 60 * 1000,
                skipOnFailure: false
            }
        },
        {
            id: "aiSummarize",
            type: WorkflowNodeType.Task,
            position: { x: 100, y: 400 },
            data: {
                label: "AI 摘要生成",
                taskType: TaskHandlerTypes.AISummarize,
                params: {
                    groupIds: Object.keys(config.groupConfigs),
                    startTimeStamp: getHoursAgoTimestamp(config.orchestrator.dataSeekTimeWindowInHours),
                    endTimeStamp: Date.now()
                },
                retryCount: 0,
                timeoutMs: 90 * 60 * 1000,
                skipOnFailure: false
            }
        },
        {
            id: "generateEmbedding",
            type: WorkflowNodeType.Task,
            position: { x: 100, y: 500 },
            data: {
                label: "生成向量嵌入",
                taskType: TaskHandlerTypes.GenerateEmbedding,
                params: {
                    startTimeStamp: getHoursAgoTimestamp(config.orchestrator.dataSeekTimeWindowInHours),
                    endTimeStamp: Date.now()
                },
                retryCount: 0,
                timeoutMs: 90 * 60 * 1000,
                skipOnFailure: false
            }
        },
        {
            id: "interestScore",
            type: WorkflowNodeType.Task,
            position: { x: 100, y: 600 },
            data: {
                label: "计算兴趣度评分",
                taskType: TaskHandlerTypes.InterestScore,
                params: {
                    startTimeStamp: getHoursAgoTimestamp(config.orchestrator.dataSeekTimeWindowInHours),
                    endTimeStamp: Date.now()
                },
                retryCount: 0,
                timeoutMs: 90 * 60 * 1000,
                skipOnFailure: false
            }
        },
        {
            id: "llmInterestEvaluation",
            type: WorkflowNodeType.Task,
            position: { x: 100, y: 700 },
            data: {
                label: "LLM 智能兴趣评估与邮件通知",
                taskType: TaskHandlerTypes.LLMInterestEvaluationAndNotification,
                params: {
                    startTimeStamp: getHoursAgoTimestamp(config.orchestrator.dataSeekTimeWindowInHours),
                    endTimeStamp: Date.now()
                },
                retryCount: 0,
                timeoutMs: 90 * 60 * 1000,
                skipOnFailure: false
            }
        },
        {
            id: "end",
            type: WorkflowNodeType.End,
            position: { x: 100, y: 800 },
            data: { label: "结束" }
        }
    ];

    const edges: WorkflowEdge[] = [
        { id: "e1", source: "start", target: "provideData" },
        { id: "e2", source: "provideData", target: "preprocess" },
        { id: "e3", source: "preprocess", target: "aiSummarize" },
        { id: "e4", source: "aiSummarize", target: "generateEmbedding" },
        { id: "e5", source: "generateEmbedding", target: "interestScore" },
        { id: "e6", source: "interestScore", target: "llmInterestEvaluation" },
        { id: "e7", source: "llmInterestEvaluation", target: "end" }
    ];

    return {
        id: "default-pipeline",
        name: "默认数据处理流程",
        description:
            "对标原有 6 步 Pipeline：ProvideData → Preprocess → AISummarize → GenerateEmbedding → InterestScore → LLMInterestEvaluation",
        nodes,
        edges,
        viewport: { x: 0, y: 0, zoom: 1 }
    };
}

/**
 * 生成报告定时工作流
 * @param config 当前配置
 * @returns 报告工作流定义数组
 */
function generateReportWorkflows(config: any): WorkflowDefinition[] {
    if (!config.report?.enabled) {
        return [];
    }

    const workflows: WorkflowDefinition[] = [];

    // 半日报工作流（每个时间点一个独立流程）
    config.report.schedule.halfDailyTimes.forEach((timeStr: string, index: number) => {
        workflows.push({
            id: `half-daily-report-${timeStr.replace(":", "")}`,
            name: `半日报 (${timeStr})`,
            description: `每日 ${timeStr} 生成半日报`,
            nodes: [
                {
                    id: "start",
                    type: WorkflowNodeType.Start,
                    position: { x: 100, y: 100 },
                    data: { label: "开始" }
                },
                {
                    id: "generateReport",
                    type: WorkflowNodeType.Task,
                    position: { x: 100, y: 200 },
                    data: {
                        label: "生成半日报",
                        taskType: TaskHandlerTypes.GenerateReport,
                        params: {
                            reportType: "half-daily",
                            timeStart: 0, // 动态计算
                            timeEnd: 0 // 动态计算
                        }
                    }
                },
                {
                    id: "end",
                    type: WorkflowNodeType.End,
                    position: { x: 100, y: 300 },
                    data: { label: "结束" }
                }
            ],
            edges: [
                { id: "e1", source: "start", target: "generateReport" },
                { id: "e2", source: "generateReport", target: "end" }
            ],
            viewport: { x: 0, y: 0, zoom: 1 }
        });
    });

    return workflows;
}

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

        // 检查配置中是否已存在 workflows，如果没有则生成默认流程
        let workflows = config.orchestrator.workflows || [];

        if (workflows.length === 0) {
            LOGGER.warning("⚠️ 配置中未找到工作流定义，生成默认流程...");
            const defaultWorkflow = generateDefaultWorkflow(config);
            const reportWorkflows = generateReportWorkflows(config);

            // 类型断言：我们确信生成的 WorkflowDefinition 符合运行时需求
            workflows = [defaultWorkflow as any, ...reportWorkflows.map(wf => wf as any)];

            // 保存到配置文件（首次启动自动生成）
            // 注意：这里需要实现配置保存逻辑，暂时只记录日志
            LOGGER.info("默认工作流已生成，需要手动更新配置文件或通过前端保存");
            LOGGER.info(JSON.stringify(workflows, null, 2));
        }

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
