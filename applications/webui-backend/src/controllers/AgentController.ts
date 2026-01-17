/**
 * Agent 控制器
 * 处理 Agent 相关的 HTTP 请求
 */
import { Request, Response } from "express";
import { injectable, inject } from "tsyringe";
import { TOKENS } from "../di/tokens";
import { AgentService } from "../services/AgentService";
import { AgentAskRequestSchema, AgentGetConversationsSchema, AgentGetMessagesSchema } from "../schemas/index";

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
}
