/**
 * Agent 控制器
 * 处理 Agent 相关的 HTTP 请求
 */
import { Request, Response } from "express";
import { injectable, inject } from "tsyringe";
import { TOKENS } from "../di/tokens";
import { AgentService } from "../services/AgentService";
import { randomUUID } from "crypto";
import type { AgentEvent } from "@root/common/rpc/ai-model/schemas";
import {
    AgentAskRequestSchema,
    AgentAskStreamRequestSchema,
    AgentForkFromCheckpointRequestSchema,
    AgentGetConversationsSchema,
    AgentGetMessagesSchema,
    AgentGetStateHistoryRequestSchema
} from "../schemas/index";

@injectable()
export class AgentController {
    constructor(@inject(TOKENS.AgentService) private agentService: AgentService) {}

    /**
     * POST /api/agent/ask
     * Agent 问答
     */
    public async ask(req: Request, res: Response): Promise<void> {
        const params = AgentAskRequestSchema.parse(req.body);
        const result = await this.agentService.askAgent({
            question: params.question,
            conversationId: params.conversationId,
            sessionId: params.sessionId,
            enabledTools: params.enabledTools,
            maxToolRounds: params.maxToolRounds,
            temperature: params.temperature,
            maxTokens: params.maxTokens
        });
        res.json({ success: true, data: result });
    }

    /**
     * POST /api/agent/ask/stream
     * Agent 问答（SSE 流式事件）
     */
    public async askStream(req: Request, res: Response): Promise<void> {
        const params = AgentAskStreamRequestSchema.parse(req.body);

        const conversationId = params.conversationId || randomUUID();

        // 单实例并发拒绝：同 conversationId 不允许并行跑
        if (!this.agentService.tryAcquireConversationLock(conversationId)) {
            res.status(409).json({
                success: false,
                error: "该对话正在运行中，请等待当前请求完成"
            });
            return;
        }

        // SSE headers
        res.status(200);
        res.setHeader("Content-Type", "text/event-stream");
        // no-transform: 避免中间层对 event-stream 做压缩/转换
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        // nginx 等反代场景下禁用缓冲（开发环境也无害）
        res.setHeader("X-Accel-Buffering", "no");
        (res as any).flushHeaders?.();

        // 立即输出一个 comment，确保中间层尽快收到字节，避免首 token 慢导致超时
        res.write(`: connected ${Date.now()}\n\n`);

        // 心跳：防止某些代理/隧道在长时间无数据时主动断开
        const heartbeatTimer = setInterval(() => {
            if (res.writableEnded) {
                return;
            }
            res.write(`: ping ${Date.now()}\n\n`);
        }, 15000);

        const abortController = new AbortController();

        const writeEvent = (event: string, data: unknown) => {
            if (res.writableEnded) {
                return;
            }

            // SSE 格式：event + data(JSON)
            res.write(`event: ${event}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        // 连接关闭时终止
        req.on("close", () => {
            abortController.abort();
        });

        try {
            await this.agentService.askAgentStream(
                {
                    question: params.question,
                    conversationId,
                    sessionId: params.sessionId,
                    enabledTools: params.enabledTools,
                    maxToolRounds: params.maxToolRounds,
                    temperature: params.temperature,
                    maxTokens: params.maxTokens
                },
                {
                    abortSignal: abortController.signal,
                    onEvent: (evt: AgentEvent) => {
                        writeEvent(evt.type ?? "message", evt);

                        if (evt.type === "done" || evt.type === "error") {
                            res.end();
                        }
                    }
                }
            );
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            writeEvent("error", {
                type: "error",
                ts: Date.now(),
                conversationId,
                error: msg
            });
            res.end();
        } finally {
            clearInterval(heartbeatTimer);
            this.agentService.releaseConversationLock(conversationId);
        }
    }

    /**
     * POST /api/agent/conversations
     * 获取对话列表
     */
    public async getConversations(req: Request, res: Response): Promise<void> {
        const params = AgentGetConversationsSchema.parse(req.body);
        const conversations = await this.agentService.getConversations(
            params.sessionId,
            params.beforeUpdatedAt,
            params.limit
        );
        res.json({ success: true, data: conversations });
    }

    /**
     * POST /api/agent/conversations/:id/messages
     * 获取对话的消息列表
     */
    public async getMessages(req: Request, res: Response): Promise<void> {
        const params = AgentGetMessagesSchema.parse({
            conversationId: req.params.id,
            beforeTimestamp: req.body?.beforeTimestamp,
            limit: req.body?.limit
        });
        const messages = await this.agentService.getMessages(
            params.conversationId,
            params.beforeTimestamp,
            params.limit
        );
        res.json({ success: true, data: messages });
    }

    /**
     * POST /api/agent/state/history
     * 获取 LangGraph thread 的 checkpoint 历史（分页）
     */
    public async getStateHistory(req: Request, res: Response): Promise<void> {
        const params = AgentGetStateHistoryRequestSchema.parse(req.body);
        const result = await this.agentService.getStateHistory(params);
        res.json({ success: true, data: result });
    }

    /**
     * POST /api/agent/state/fork
     * 从某个 checkpoint fork 新 thread
     */
    public async forkFromCheckpoint(req: Request, res: Response): Promise<void> {
        const params = AgentForkFromCheckpointRequestSchema.parse(req.body);
        const result = await this.agentService.forkFromCheckpoint(params);
        res.json({ success: true, data: result });
    }
}
