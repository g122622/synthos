/**
 * 工作流控制器
 *
 * 处理工作流相关的HTTP请求，调用orchestrator RPC服务
 */
import type { OrchestratorClient } from "../rpc/orchestratorClient";

import { Request, Response } from "express";
import { inject, singleton } from "tsyringe";
import Logger from "@root/common/util/Logger";

import { TOKENS } from "../di/tokens";

const LOGGER = Logger.withTag("🔀 WorkflowController");

@singleton()
export class WorkflowController {
    public constructor(
        @inject(TOKENS.OrchestratorClient) private readonly orchestratorClient: OrchestratorClient
    ) {}

    /**
     * 获取所有工作流列表
     */
    public async listWorkflows(req: Request, res: Response): Promise<void> {
        try {
            // @ts-ignore - tRPC 类型推断问题，运行时正常
            const workflows = await this.orchestratorClient.listWorkflows.query();

            res.json(workflows);
        } catch (error) {
            LOGGER.error(`获取工作流列表失败: ${error}`);
            res.status(500).json({ error: "获取工作流列表失败" });
        }
    }

    /**
     * 获取单个工作流定义
     */
    public async getWorkflow(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;

            if (!id) {
                res.status(400).json({ error: "缺少工作流ID" });

                return;
            }

            // @ts-ignore - tRPC 类型推断问题，运行时正常
            const workflow = await this.orchestratorClient.getWorkflow.query({ id });

            res.json(workflow);
        } catch (error) {
            LOGGER.error(`获取工作流失败: ${error}`);
            res.status(500).json({ error: "获取工作流失败" });
        }
    }

    /**
     * 保存工作流定义
     */
    public async saveWorkflow(req: Request, res: Response): Promise<void> {
        try {
            const workflow = req.body;

            if (!workflow) {
                res.status(400).json({ error: "缺少工作流定义" });

                return;
            }

            // 确保工作流有ID
            if (!workflow.id) {
                workflow.id = `wf-${Date.now()}`;
            }

            // 调用 orchestrator RPC 保存到配置文件
            // @ts-ignore - tRPC 类型推断问题，运行时正常
            const result = await this.orchestratorClient.saveWorkflow.mutate(workflow);

            if (result.success) {
                res.json(result.workflow);
            } else {
                res.status(500).json({ error: result.message });
            }
        } catch (error) {
            LOGGER.error(`保存工作流失败: ${error}`);
            res.status(500).json({ error: "保存工作流失败" });
        }
    }

    /**
     * 删除工作流
     */
    public async deleteWorkflow(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;

            if (!id) {
                res.status(400).json({ error: "缺少工作流ID" });

                return;
            }

            // TODO: 实际删除逻辑需要在orchestrator中实现
            res.status(204).send();
        } catch (error) {
            LOGGER.error(`删除工作流失败: ${error}`);
            res.status(500).json({ error: "删除工作流失败" });
        }
    }

    /**
     * 触发工作流执行
     */
    public async triggerWorkflow(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;

            if (!id) {
                res.status(400).json({ error: "缺少工作流ID" });

                return;
            }

            const globalVars = req.body || {};

            // @ts-ignore - tRPC 类型推断问题，运行时正常
            const result = await this.orchestratorClient.triggerWorkflow.mutate({
                workflowId: id,
                globalVars
            });

            res.json(result);
        } catch (error) {
            LOGGER.error(`触发工作流失败: ${error}`);
            res.status(500).json({ error: "触发工作流失败" });
        }
    }

    /**
     * 取消执行
     */
    public async cancelExecution(req: Request, res: Response): Promise<void> {
        try {
            const { executionId } = req.params;

            if (!executionId) {
                res.status(400).json({ error: "缺少执行ID" });

                return;
            }

            // @ts-ignore - tRPC 类型推断问题，运行时正常
            const result = await this.orchestratorClient.cancelExecution.mutate({ executionId });

            res.json(result);
        } catch (error) {
            LOGGER.error(`取消执行失败: ${error}`);
            res.status(500).json({ error: "取消执行失败" });
        }
    }

    /**
     * 断点续跑
     */
    public async resumeExecution(req: Request, res: Response): Promise<void> {
        try {
            const { executionId } = req.params;

            if (!executionId) {
                res.status(400).json({ error: "缺少执行ID" });

                return;
            }

            // @ts-ignore - tRPC 类型推断问题，运行时正常
            const result = await this.orchestratorClient.retryExecution.mutate({ executionId });

            res.json(result);
        } catch (error) {
            LOGGER.error(`断点续跑失败: ${error}`);
            res.status(500).json({ error: "断点续跑失败" });
        }
    }

    /**
     * 获取执行历史列表
     */
    public async listExecutions(req: Request, res: Response): Promise<void> {
        try {
            const { workflowId, page = "1", pageSize = "50" } = req.query;

            if (!workflowId || typeof workflowId !== "string") {
                res.status(400).json({ error: "缺少工作流ID" });

                return;
            }

            const limit = parseInt(pageSize as string, 10);

            // @ts-ignore - tRPC 类型推断问题，运行时正常
            const executions = await this.orchestratorClient.listExecutions.query({
                workflowId,
                limit
            });

            // 包装为前端需要的格式
            res.json({
                executions,
                total: executions.length // 暂时返回当前批次数量，后续orchestrator实现分页后调整
            });
        } catch (error) {
            LOGGER.error(`获取执行历史失败: ${error}`);
            res.status(500).json({ error: "获取执行历史失败" });
        }
    }

    /**
     * 获取单次执行的完整信息
     */
    public async getExecution(req: Request, res: Response): Promise<void> {
        try {
            const { executionId } = req.params;

            if (!executionId) {
                res.status(400).json({ error: "缺少执行ID" });

                return;
            }

            // @ts-ignore - tRPC 类型推断问题，运行时正常
            const execution = await this.orchestratorClient.getExecution.query({ executionId });

            res.json(execution);
        } catch (error) {
            LOGGER.error(`获取执行详情失败: ${error}`);
            res.status(500).json({ error: "获取执行详情失败" });
        }
    }

    /**
     * 订阅执行状态（SSE）
     */
    public async subscribeExecution(req: Request, res: Response): Promise<void> {
        try {
            const { executionId } = req.params;

            if (!executionId) {
                res.status(400).json({ error: "缺少执行ID" });

                return;
            }

            // 设置 SSE 响应头
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");

            // @ts-ignore - tRPC 类型推断问题，运行时正常
            const subscription = this.orchestratorClient.onExecutionUpdate.subscribe(
                { executionId },
                {
                    onData: (data: any) => {
                        res.write(`data: ${JSON.stringify(data)}\n\n`);
                    },
                    onError: (error: any) => {
                        LOGGER.error(`执行状态订阅错误: ${error}`);
                        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
                        res.end();
                    },
                    onComplete: () => {
                        res.end();
                    }
                }
            );

            // 客户端断开连接时取消订阅
            req.on("close", () => {
                subscription.unsubscribe();
            });
        } catch (error) {
            LOGGER.error(`建立执行状态订阅失败: ${error}`);
            res.status(500).json({ error: "建立执行状态订阅失败" });
        }
    }
}
