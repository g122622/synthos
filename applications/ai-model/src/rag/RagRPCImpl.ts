/**
 * RAG RPC 实现
 * 提供语义搜索和 RAG 问答能力
 */
import "reflect-metadata";
import { injectable, inject, container } from "tsyringe";
import {
    RAGRPCImplementation,
    SearchOutput,
    AskOutput,
    AskStreamChunk,
    TriggerReportGenerateOutput,
    SendReportEmailOutput
} from "@root/common/rpc/ai-model/index";
import type { AgentGetConversationsOutput, AgentGetMessagesOutput } from "@root/common/rpc/ai-model/schemas";
import { VectorDBManagerService } from "../services/embedding/VectorDBManagerService";
import { EmbeddingService } from "../services/embedding/EmbeddingService";
import { AgcDbAccessService } from "@root/common/services/database/AgcDbAccessService";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { ReportDbAccessService } from "@root/common/services/database/ReportDbAccessService";
import { TextGeneratorService } from "../services/generators/text/TextGeneratorService";
import Logger from "@root/common/util/Logger";
import { RAGCtxBuilder } from "../context/ctxBuilders/RAGCtxBuilder";
import { QueryRewriter } from "./QueryRewriter";
import { EmbeddingPromptStore } from "../context/prompts/EmbeddingPromptStore";
import { agendaInstance } from "@root/common/scheduler/agenda";
import { TaskHandlerTypes, TaskParameters } from "@root/common/scheduler/@types/Tasks";
import { ReportType } from "@root/common/contracts/report/index";
import { AI_MODEL_TOKENS } from "../di/tokens";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import { ReportEmailService } from "../services/email/ReportEmailService";
import { COMMON_TOKENS } from "@root/common/di/tokens";
import { ToolContext, AgentStreamChunk, AgentResult } from "../agent/contracts/index";
import { AgentDbAccessService, AgentMessage } from "@root/common/services/database/AgentDbAccessService";
import { AgentPromptStore } from "../context/prompts/AgentPromptStore";
import { LangGraphAgentExecutor } from "../agent-langgraph/LangGraphAgentExecutor";
import { AgentToolCatalog } from "../agent-langgraph/AgentToolCatalog";
import { randomUUID } from "crypto";

/**
 * RAG RPC 实现类
 * 提供语义搜索、RAG 问答、日报生成触发和日报邮件发送能力
 */
@injectable()
export class RagRPCImpl implements RAGRPCImplementation {
    private LOGGER = Logger.withTag("RagRPCImpl");
    private queryRewriter: QueryRewriter;
    private defaultModelName: string = "";

    public constructor(
        @inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService,
        @inject(AI_MODEL_TOKENS.VectorDBManagerService) private vectorDB: VectorDBManagerService,
        @inject(COMMON_TOKENS.AgcDbAccessService) private agcDB: AgcDbAccessService,
        @inject(COMMON_TOKENS.ImDbAccessService) private imDB: ImDbAccessService,
        @inject(COMMON_TOKENS.ReportDbAccessService) private reportDB: ReportDbAccessService,
        @inject(AI_MODEL_TOKENS.TextGeneratorService) private TextGeneratorService: TextGeneratorService,
        @inject(AI_MODEL_TOKENS.RAGCtxBuilder) private ragCtxBuilder: RAGCtxBuilder,
        @inject(AI_MODEL_TOKENS.EmbeddingService) private embeddingService: EmbeddingService,
        @inject(AI_MODEL_TOKENS.LangGraphAgentExecutor) private agentExecutor: LangGraphAgentExecutor,
        @inject(COMMON_TOKENS.AgentDbAccessService) private agentDB: AgentDbAccessService,
        @inject(AI_MODEL_TOKENS.AgentToolCatalog) private agentToolCatalog: AgentToolCatalog
    ) {
        // QueryRewriter 将在 init 方法中初始化
        this.queryRewriter = null as any;
    }

    /**
     * 初始化 RPC 实现
     * 必须在使用前调用
     */
    public async init(): Promise<void> {
        const config = await this.configManagerService.getCurrentConfig();
        this.defaultModelName = config.ai.defaultModelName;
        // 创建 QueryRewriter 实例
        this.queryRewriter = new QueryRewriter(this.TextGeneratorService, this.defaultModelName);
        // 初始化 RAGCtxBuilder
        await this.ragCtxBuilder.init();
    }

    /**
     * 语义搜索
     */
    public async search(input: { query: string; limit: number }): Promise<SearchOutput> {
        this.LOGGER.info(`收到搜索请求: "${input.query}", limit=${input.limit}`);

        // 1. 将查询转换为向量
        const queryEmbedding = await this.embeddingService.embed(
            EmbeddingPromptStore.getEmbeddingPromptForRAG(input.query)
        );
        this.LOGGER.debug(`查询向量生成完成，维度: ${queryEmbedding.length}`);

        // 2. 向量搜索
        const results = this.vectorDB.searchSimilar(queryEmbedding, [], input.limit);
        this.LOGGER.debug(`向量搜索完成，找到 ${results.length} 条结果`);

        // 3. 获取完整的话题信息
        const output: SearchOutput = [];
        for (const result of results) {
            const digest = await this.agcDB.getAIDigestResultByTopicId(result.topicId);
            if (digest) {
                output.push({
                    topicId: result.topicId,
                    topic: digest.topic,
                    detail: digest.detail,
                    distance: result.distance,
                    contributors: digest.contributors
                });
            }
        }

        this.LOGGER.success(`搜索完成，返回 ${output.length} 条结果`);
        return output;
    }

    /**
     * RAG 问答
     */
    public async ask(input: { question: string; topK: number; enableQueryRewriter: boolean }): Promise<AskOutput> {
        this.LOGGER.info(
            `收到问答请求: "${input.question}", topK=${input.topK}, enableQueryRewriter=${input.enableQueryRewriter}`
        );

        let deduplicatedResults: SearchOutput;

        if (input.enableQueryRewriter) {
            // 1. 使用 Multi-Query 扩展原始问题
            const expandedQueries = await this.queryRewriter.expandQuery(input.question);
            this.LOGGER.info(`Multi-Query 扩展完成，共 ${expandedQueries.length} 个查询`);

            // 2. 对每个扩展查询进行搜索
            const allResults: SearchOutput = [];
            for (const query of expandedQueries) {
                this.LOGGER.debug(`执行查询: "${query}"`);
                const results = await this.search({ query, limit: input.topK });
                allResults.push(...results);
            }
            this.LOGGER.info(`Multi-Query 搜索完成，共获取 ${allResults.length} 条原始结果`);

            // 3. 文档去重（基于 topicId）
            deduplicatedResults = this.deduplicateResults(allResults);
            this.LOGGER.info(`文档去重完成，去重后剩余 ${deduplicatedResults.length} 条结果`);
        } else {
            // 直接搜索，不使用 Query Rewriter
            this.LOGGER.info("Query Rewriter 已禁用，直接执行搜索");
            deduplicatedResults = await this.search({ query: input.question, limit: input.topK });
            this.LOGGER.info(`搜索完成，共获取 ${deduplicatedResults.length} 条结果`);
        }

        if (deduplicatedResults.length === 0) {
            this.LOGGER.warning("未找到相关话题");
            return {
                answer: "抱歉，没有找到与您问题相关的话题内容。",
                references: []
            };
        }

        // 4. 按相关性排序，取 topK 条（因为 multi-query+去重后的结果数量大概率也是超过 topK 的）
        const topResults = deduplicatedResults
            .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
            .slice(0, input.topK);

        // 5. 构建 RAG prompt
        const prompt = await this.ragCtxBuilder.buildCtx(input.question, topResults);
        this.LOGGER.success(`RAG prompt 构建完成，长度: ${prompt.length}`);

        // 6. 调用 LLM 生成回答
        const { content: answer } = await this.TextGeneratorService.generateTextWithModelCandidates(
            [this.defaultModelName],
            prompt
        );
        this.LOGGER.success(`LLM 回答生成完成，长度: ${answer.length}`);

        // 7. 构建引用列表
        const references = topResults.map(r => ({
            topicId: r.topicId,
            topic: r.topic,
            relevance: Math.max(0, 1 - (r.distance ?? 1)) // 距离转相关性，确保非负
        }));

        return {
            answer,
            references
        };
    }

    /**
     * RAG 问答（流式）
     */
    public async askStream(
        input: { question: string; topK: number; enableQueryRewriter: boolean },
        onChunk: (chunk: AskStreamChunk) => void
    ): Promise<void> {
        this.LOGGER.info(
            `收到流式问答请求: "${input.question}", topK=${input.topK}, enableQueryRewriter=${input.enableQueryRewriter}`
        );

        try {
            let deduplicatedResults: SearchOutput;

            if (input.enableQueryRewriter) {
                // 1. 使用 Multi-Query 扩展原始问题
                const expandedQueries = await this.queryRewriter.expandQuery(input.question);
                this.LOGGER.debug(`Multi-Query 扩展完成，共 ${expandedQueries.length} 个查询`);

                // 2. 对每个扩展查询进行搜索
                const allResults: SearchOutput = [];
                for (const query of expandedQueries) {
                    const results = await this.search({ query, limit: input.topK });
                    allResults.push(...results);
                }

                // 3. 文档去重
                deduplicatedResults = this.deduplicateResults(allResults);
            } else {
                this.LOGGER.debug("Query Rewriter 已禁用，直接执行搜索");
                deduplicatedResults = await this.search({ query: input.question, limit: input.topK });
            }

            if (deduplicatedResults.length === 0) {
                this.LOGGER.warning("未找到相关话题");
                onChunk({ type: "content", content: "抱歉，没有找到与您问题相关的话题内容。" });
                onChunk({ type: "references", references: [] });
                return;
            }

            // 4. 按相关性排序，取 topK 条
            const topResults = deduplicatedResults
                .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
                .slice(0, input.topK);

            // 5. 构建 RAG prompt
            const prompt = await this.ragCtxBuilder.buildCtx(input.question, topResults);
            this.LOGGER.debug(`RAG prompt 构建完成，长度: ${prompt.length}`);

            // 6. 构建引用列表并发送
            const references = topResults.map(r => ({
                topicId: r.topicId,
                topic: r.topic,
                relevance: Math.max(0, 1 - (r.distance ?? 1))
            }));
            onChunk({ type: "references", references });

            // 7. 调用 LLM 生成回答（流式）
            await this.TextGeneratorService.generateTextStreamWithModelCandidates(
                [this.defaultModelName],
                prompt,
                chunk => {
                    onChunk({ type: "content", content: chunk });
                }
            );

            this.LOGGER.success(`流式问答完成`);
        } catch (error) {
            this.LOGGER.error(`流式问答发生错误: ${error}`);
            onChunk({
                type: "error",
                error: error instanceof Error ? error.message : String(error)
            });
            // 不抛出错误，以免中断 observable（虽然 router 里 catch 了）
        }
    }

    /**
     * 触发生成日报
     * 通过 Agenda 调度一个即时任务来生成日报
     */
    public async triggerReportGenerate(input: {
        type: "half-daily" | "weekly" | "monthly";
        timeStart?: number;
        timeEnd?: number;
    }): Promise<TriggerReportGenerateOutput> {
        this.LOGGER.info(`收到手动触发日报生成请求: type=${input.type}`);

        try {
            // 计算时间范围
            const now = Date.now();
            let timeStart: number;
            let timeEnd: number;

            if (input.timeStart !== undefined && input.timeEnd !== undefined) {
                // 使用用户指定的时间范围
                timeStart = input.timeStart;
                timeEnd = input.timeEnd;
            } else {
                // 使用默认时间范围
                timeEnd = now;
                switch (input.type) {
                    case "half-daily":
                        timeStart = now - 12 * 60 * 60 * 1000; // 过去 12 小时
                        break;
                    case "weekly":
                        timeStart = now - 7 * 24 * 60 * 60 * 1000; // 过去 7 天
                        break;
                    case "monthly":
                        timeStart = now - 30 * 24 * 60 * 60 * 1000; // 过去 30 天
                        break;
                }
            }

            this.LOGGER.info(
                `日报时间范围: ${new Date(timeStart).toISOString()} - ${new Date(timeEnd).toISOString()}`
            );

            // 调度即时任务
            const taskData: TaskParameters<TaskHandlerTypes.GenerateReport> = {
                reportType: input.type as ReportType,
                timeStart,
                timeEnd
            };

            await agendaInstance.now<TaskParameters<TaskHandlerTypes.GenerateReport>>(
                TaskHandlerTypes.GenerateReport,
                taskData
            );

            this.LOGGER.success(`日报生成任务已调度: ${input.type}`);

            return {
                success: true,
                message: `${input.type} 日报生成任务已提交，请稍后刷新查看结果`
            };
        } catch (error) {
            this.LOGGER.error(`触发日报生成失败: ${error}`);
            return {
                success: false,
                message: `触发失败: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * 发送日报邮件
     * 根据 reportId 获取日报，并发送邮件到配置的收件人
     * @param input 包含 reportId 的输入
     * @returns 发送结果
     */
    public async sendReportEmail(input: { reportId: string }): Promise<SendReportEmailOutput> {
        this.LOGGER.info(`收到发送日报邮件请求: reportId=${input.reportId}`);

        try {
            // 1. 根据 reportId 获取日报
            const report = await this.reportDB.getReportById(input.reportId);
            if (!report) {
                this.LOGGER.warning(`未找到日报: ${input.reportId}`);
                return {
                    success: false,
                    message: "未找到对应的日报"
                };
            }

            // 2. 调用 ReportEmailService 发送邮件（手动发送，绕过 config.report.sendEmail 开关）
            const reportEmailService = container.resolve<ReportEmailService>(AI_MODEL_TOKENS.ReportEmailService);
            const success = await reportEmailService.sendReportEmailManually(report);

            if (success) {
                this.LOGGER.success(`日报邮件发送成功: ${input.reportId}`);
                return {
                    success: true,
                    message: "日报邮件发送成功"
                };
            } else {
                this.LOGGER.warning(`日报邮件发送失败: ${input.reportId}`);
                return {
                    success: false,
                    message: "日报邮件发送失败，请检查邮件配置是否正确"
                };
            }
        } catch (error) {
            this.LOGGER.error(`发送日报邮件时发生错误: ${error}`);
            return {
                success: false,
                message: `发送失败: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * 获取 Agent 对话列表（分页）
     */
    public async agentGetConversations(input: {
        sessionId?: string;
        beforeUpdatedAt?: number;
        limit: number;
    }): Promise<AgentGetConversationsOutput> {
        this.LOGGER.info(
            `获取 Agent 对话列表: sessionId=${input.sessionId || ""}, beforeUpdatedAt=${input.beforeUpdatedAt || ""}, limit=${input.limit}`
        );

        const conversations = await this.agentDB.getConversationsPage(
            input.sessionId,
            input.beforeUpdatedAt,
            input.limit
        );

        return conversations;
    }

    /**
     * 获取 Agent 消息列表（分页）
     */
    public async agentGetMessages(input: {
        conversationId: string;
        beforeTimestamp?: number;
        limit: number;
    }): Promise<AgentGetMessagesOutput> {
        this.LOGGER.info(
            `获取 Agent 消息列表: conversationId=${input.conversationId}, beforeTimestamp=${input.beforeTimestamp || ""}, limit=${input.limit}`
        );

        const messages = await this.agentDB.getMessagesPage(
            input.conversationId,
            input.beforeTimestamp,
            input.limit
        );

        return messages;
    }

    /**
     * 文档去重
     * 基于 topicId 去重。去重逻辑：在topicId相同的情况下，保留距离最小（相关性最高）的结果
     */
    private deduplicateResults(results: SearchOutput): SearchOutput {
        const topicMap = new Map<string, SearchOutput[number]>();

        for (const result of results) {
            const topicId = result.topicId;
            // 跳过无效的 topicId（理论上不会发生，但满足 TS 严格模式）
            if (!topicId) {
                continue;
            }

            const existing = topicMap.get(topicId);
            if (!existing) {
                // 新的 topicId，直接加入
                topicMap.set(topicId, result);
            } else {
                // 已存在，保留距离更小的（相关性更高）
                const currentDistance = result.distance ?? Infinity;
                const existingDistance = existing.distance ?? Infinity;
                if (currentDistance < existingDistance) {
                    topicMap.set(topicId, result);
                }
            }
        }

        return Array.from(topicMap.values());
    }

    /**
     * Agent 问答（流式）
     */
    public async agentAsk(
        input: {
            question: string;
            conversationId?: string;
            sessionId?: string;
            enabledTools?: ("rag_search" | "sql_query" | "web_search")[];
            maxToolRounds?: number;
            temperature?: number;
            maxTokens?: number;
        },
        onChunk: (chunk: AgentStreamChunk) => void
    ): Promise<{
        conversationId: string;
        messageId: string;
        content: string;
        toolsUsed: string[];
        toolRounds: number;
        totalUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
    }> {
        this.LOGGER.info(`收到 Agent 问答请求: "${input.question}"`);

        // 1. 确定对话 ID
        let conversationId: string = input.conversationId || randomUUID();
        if (!input.conversationId) {
            // 创建新对话
            await this.agentDB.createConversation(
                conversationId,
                input.question.substring(0, 50), // 用问题前50个字符作为标题
                input.sessionId
            );
            this.LOGGER.info(`创建新对话: ${conversationId}`);
        }

        // 2. 保存用户消息
        const userMessageId = randomUUID();
        const userMessage: AgentMessage = {
            id: userMessageId,
            conversationId,
            role: "user",
            content: input.question,
            timestamp: Date.now()
        };
        await this.agentDB.addMessage(userMessage);

        // 3. 获取历史消息
        const historyMessages = await this.agentDB.getMessagesByConversationId(conversationId);
        const chatHistory = historyMessages.slice(0, -1).map(msg => ({
            role: msg.role as "user" | "assistant" | "system",
            content: msg.content
        }));

        // 4. 构建系统提示词（只暴露启用的工具，避免模型乱用/误用）
        const effectiveEnabledTools = input.enabledTools || ["rag_search", "sql_query"];
        const enabledToolDefinitions = this.agentToolCatalog.getEnabledToolDefinitions(effectiveEnabledTools);
        const systemPromptNode = await AgentPromptStore.getAgentSystemPrompt(enabledToolDefinitions);
        const systemPrompt = systemPromptNode.serializeToString();

        // 5. 构建工具上下文
        const toolContext: ToolContext = {
            sessionId: input.sessionId,
            conversationId,
            userQuestion: input.question
        };

        // 6. 执行 Agent（流式）
        const result: AgentResult = await this.agentExecutor.executeStream(
            input.question,
            toolContext,
            onChunk,
            {
                enabledTools: effectiveEnabledTools,
                maxToolRounds: input.maxToolRounds,
                temperature: input.temperature,
                maxTokens: input.maxTokens
            },
            chatHistory,
            systemPrompt
        );

        // 7. 保存 Assistant 消息
        const assistantMessageId = randomUUID();
        const assistantMessage: AgentMessage = {
            id: assistantMessageId,
            conversationId,
            role: "assistant",
            content: result.content,
            timestamp: Date.now(),
            toolsUsed: JSON.stringify(result.toolsUsed),
            toolRounds: result.toolRounds,
            tokenUsage: result.totalUsage ? JSON.stringify(result.totalUsage) : undefined
        };
        await this.agentDB.addMessage(assistantMessage);

        // 8. done 事件：由落库后统一发出（确保 messageId 可用）
        onChunk({
            type: "done",
            ts: Date.now(),
            conversationId,
            messageId: assistantMessageId,
            content: result.content,
            toolsUsed: result.toolsUsed,
            toolRounds: result.toolRounds,
            totalUsage: result.totalUsage
        });

        this.LOGGER.success(`Agent 问答完成: ${conversationId}`);

        return {
            conversationId,
            messageId: assistantMessageId,
            content: result.content,
            toolsUsed: result.toolsUsed,
            toolRounds: result.toolRounds,
            totalUsage: result.totalUsage
        };
    }

    /**
     * 获取 LangGraph checkpoint 历史（分页）
     */
    public async agentGetStateHistory(input: {
        conversationId: string;
        limit: number;
        beforeCheckpointId?: string;
    }): Promise<any> {
        return this.agentExecutor.getStateHistory({
            conversationId: input.conversationId,
            limit: input.limit,
            beforeCheckpointId: input.beforeCheckpointId
        });
    }

    /**
     * 从指定 checkpoint fork 新 thread
     */
    public async agentForkFromCheckpoint(input: {
        conversationId: string;
        checkpointId: string;
        newConversationId?: string;
    }): Promise<any> {
        const forked = await this.agentExecutor.forkFromCheckpoint({
            conversationId: input.conversationId,
            checkpointId: input.checkpointId,
            newConversationId: input.newConversationId
        });

        // 为了让前端历史列表可见，这里同时创建一条新的 conversation 记录（不复制消息）。
        await this.agentDB.createConversation(forked.conversationId, `Fork of ${input.conversationId}`, undefined);

        return forked;
    }
}
