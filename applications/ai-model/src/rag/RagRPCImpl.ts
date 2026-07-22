/**
 * RAG RPC 实现
 * 提供语义搜索和 RAG 问答能力
 */
import "reflect-metadata";
import type { AgentGetConversationsOutput, AgentGetMessagesOutput } from "@root/common/rpc/ai-model/schemas";
import type { AIDigestResult } from "@root/common/contracts/ai-model";

import { randomUUID } from "crypto";

import { injectable, inject, container } from "tsyringe";
import {
    RAGRPCImplementation,
    AITaskImplementation,
    SearchOutput,
    AskOutput,
    AskStreamChunk,
    TriggerReportGenerateOutput,
    SendReportEmailOutput,
    MemberProfileGenerateOutput,
    AISummarizeOutput,
    GenerateEmbeddingOutput,
    GenerateReportOutput,
    InterestScoreOutput,
    LLMInterestEvaluationOutput
} from "@root/common/rpc/ai-model/index";
import { AgcDbAccessService } from "@root/common/services/database/AgcDbAccessService";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { ReportDbAccessService } from "@root/common/services/database/ReportDbAccessService";
import { MemberProfileDbAccessService } from "@root/common/services/database/MemberProfileDbAccessService";
import Logger from "@root/common/util/Logger";
import { ReportType } from "@root/common/contracts/report/index";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import { COMMON_TOKENS } from "@root/common/di/tokens";
import { AgentDbAccessService, AgentMessage } from "@root/common/services/database/AgentDbAccessService";

import { AI_MODEL_TOKENS } from "../di/tokens";
import { ReportEmailService } from "../services/email/ReportEmailService";
import { ToolContext, AgentStreamChunk, AgentResult } from "../agent/contracts/index";
import { EmbeddingPromptStore } from "../context/prompts/EmbeddingPromptStore";
import { RAGCtxBuilder } from "../context/ctxBuilders/RAGCtxBuilder";
import { MemberProfileCtxBuilder } from "../context/ctxBuilders/MemberProfileCtxBuilder";
import { TextGeneratorService } from "../services/generators/text/TextGeneratorService";
import {
    PooledTextGeneratorService,
    PooledTask,
    PooledTaskResult
} from "../services/generators/text/PooledTextGeneratorService";
import { EmbeddingService } from "../services/embedding/EmbeddingService";
import { VectorDBManagerService } from "../services/embedding/VectorDBManagerService";
import { AgentPromptStore } from "../context/prompts/AgentPromptStore";
import { LangGraphAgentExecutor } from "../agent-langgraph/LangGraphAgentExecutor";
import { AgentToolCatalog } from "../agent-langgraph/AgentToolCatalog";
import { AISummarizeTaskHandler } from "../tasks/AISummarize";
import { GenerateEmbeddingTaskHandler } from "../tasks/GenerateEmbedding";
import { GenerateReportTaskHandler } from "../tasks/GenerateReport";
import { InterestScoreTaskHandler } from "../tasks/InterestScore";
import { LLMInterestEvaluationAndNotificationTaskHandler } from "../tasks/LLMInterestEvaluationAndNotification";

import { QueryRewriter } from "./QueryRewriter";

/**
 * RAG RPC 实现类
 * 提供语义搜索、RAG 问答、日报生成触发和日报邮件发送能力
 */
@injectable()
export class RagRPCImpl implements RAGRPCImplementation, AITaskImplementation {
    private LOGGER = Logger.withTag("RagRPCImpl");
    private queryRewriter: QueryRewriter;
    private defaultModelName: string = "";

    /** 群友画像分片：每组话题数（≤500 走 1 个分片特例） */
    private static readonly PROFILE_BATCH_SIZE = 500;

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
        @inject(AI_MODEL_TOKENS.AgentToolCatalog) private agentToolCatalog: AgentToolCatalog,
        @inject(COMMON_TOKENS.MemberProfileDbAccessService) private memberProfileDB: MemberProfileDbAccessService,
        @inject(AI_MODEL_TOKENS.MemberProfileCtxBuilder) private memberProfileCtxBuilder: MemberProfileCtxBuilder,
        @inject(AI_MODEL_TOKENS.AISummarizeTaskHandler) private aiSummarizeTaskHandler: AISummarizeTaskHandler,
        @inject(AI_MODEL_TOKENS.GenerateEmbeddingTaskHandler)
        private generateEmbeddingTaskHandler: GenerateEmbeddingTaskHandler,
        @inject(AI_MODEL_TOKENS.GenerateReportTaskHandler)
        private generateReportTaskHandler: GenerateReportTaskHandler,
        @inject(AI_MODEL_TOKENS.InterestScoreTaskHandler)
        private interestScoreTaskHandler: InterestScoreTaskHandler,
        @inject(AI_MODEL_TOKENS.LLMInterestEvaluationAndNotificationTaskHandler)
        private llmInterestEvaluationTaskHandler: LLMInterestEvaluationAndNotificationTaskHandler
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
        // 初始化 MemberProfileCtxBuilder
        await this.memberProfileCtxBuilder.init();
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
    public async ask(input: {
        question: string;
        topK: number;
        enableQueryRewriter: boolean;
        modelName?: string;
    }): Promise<AskOutput> {
        this.LOGGER.info(
            `收到问答请求: "${input.question}", topK=${input.topK}, enableQueryRewriter=${input.enableQueryRewriter}, modelName=${input.modelName || "(默认)"}`
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
        const modelName = input.modelName || this.defaultModelName;
        const { content: answer } = await this.TextGeneratorService.generateTextWithModelCandidates(
            [modelName],
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
        input: { question: string; topK: number; enableQueryRewriter: boolean; modelName?: string },
        onChunk: (chunk: AskStreamChunk) => void
    ): Promise<void> {
        this.LOGGER.info(
            `收到流式问答请求: "${input.question}", topK=${input.topK}, enableQueryRewriter=${input.enableQueryRewriter}, modelName=${input.modelName || "(默认)"}`
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
            const modelName = input.modelName || this.defaultModelName;

            await this.TextGeneratorService.generateTextStreamWithModelCandidates([modelName], prompt, chunk => {
                onChunk({ type: "content", content: chunk });
            });

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
     * 同步调用 GenerateReportTaskHandler 生成日报并返回结果
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

            // 同步调用日报生成任务（阻塞至生成完成）
            const result = await this.generateReportTaskHandler.run({
                reportType: input.type as ReportType,
                timeStart,
                timeEnd
            });

            this.LOGGER.success(`日报生成完成: ${input.type}, reportId=${result.reportId}`);

            return {
                success: true,
                message: `${input.type} 日报生成完成`,
                reportId: result.reportId || undefined
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
            modelName?: string;
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
            systemPrompt,
            input.modelName
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

    /**
     * 群友画像生成
     * 根据 QQ号 反查该群友参与的所有话题摘要，聚合后由 LLM 生成结构化画像并落库
     * 非流式：直接返回完整画像（JSON 在生成完成前无法解析，流式无展示价值）
     * @param input 群友 QQ号 + 可选昵称
     * @returns 生成结果（成功时携带画像内容与落库记录，失败时携带 message）
     */
    public async generateMemberProfile(input: {
        senderId: string;
        nickname?: string;
    }): Promise<MemberProfileGenerateOutput> {
        this.LOGGER.info(`收到群友画像生成请求: senderId=${input.senderId}`);

        // 1. 反查该群友参与的所有话题（跨所有会话/群组）
        const digestResults = await this.agcDB.getAIDigestResultsByContributorId(input.senderId);

        if (digestResults.length === 0) {
            this.LOGGER.warning(`senderId=${input.senderId} 未参与任何已摘要话题，无法生成画像`);

            return { success: false, message: "该群友未参与任何已摘要话题，无法生成画像" };
        }

        // 2. 收集该群友的全部已知昵称（改名前后均含），确定展示用昵称
        const knownNicknames = this._collectNicknames(digestResults, input.senderId);
        // 入参昵称优先且补进已知列表（前端可能传入更准确的当前昵称）
        const nickname = input.nickname ?? knownNicknames[0] ?? input.senderId;
        const fullNicknames =
            input.nickname && !knownNicknames.includes(input.nickname)
                ? [input.nickname, ...knownNicknames]
                : knownNicknames;

        this.LOGGER.info(
            `群友画像昵称解析: senderId=${input.senderId}, displayNickname=${nickname}, ` +
                `knownNicknames=[${fullNicknames.join(", ")}]`
        );

        // 3. 统一分片 Map-Reduce：按每 PROFILE_BATCH_SIZE 个话题切分，并行生成子画像后汇总
        //    ≤500 话题时切片数为 1，走"仅1组成功直接落库"特例，与原单次生成等价
        return this._generateMemberProfileMapReduce(input.senderId, nickname, fullNicknames, digestResults);
    }

    /**
     * 分片 Map-Reduce 生成群友画像
     * 按每 PROFILE_BATCH_SIZE 个话题切分，并行生成各分片子画像；≥2 份成功则汇总，1 份成功直接落库，0 份失败
     * 重试依赖 generateTextWithModelCandidates 内置候选模型链（checkJsonFormat:true 时坏 JSON 自动换模型重试）
     * @param senderId 群友 QQ号
     * @param nickname 群友昵称（仅展示）
     * @param knownNicknames 该群友全部已知昵称（均指同一人，注入 prompt 消除改名身份歧义）
     * @param digestResults 该群友参与的所有话题摘要
     * @returns 生成结果
     */
    private async _generateMemberProfileMapReduce(
        senderId: string,
        nickname: string,
        knownNicknames: string[],
        digestResults: AIDigestResult[]
    ): Promise<MemberProfileGenerateOutput> {
        const total = digestResults.length;
        const chunkCount = Math.ceil(total / RagRPCImpl.PROFILE_BATCH_SIZE);

        this.LOGGER.info(
            `群友画像进入分片模式: senderId=${senderId}, topicCount=${total}, ` +
                `分片数=${chunkCount}, 每片=${RagRPCImpl.PROFILE_BATCH_SIZE}`
        );

        // 切片
        const chunks: AIDigestResult[][] = [];

        for (let i = 0; i < total; i += RagRPCImpl.PROFILE_BATCH_SIZE) {
            chunks.push(digestResults.slice(i, i + RagRPCImpl.PROFILE_BATCH_SIZE));
        }

        // 并行池（参照 AISummarize.ts）
        const config = await this.configManagerService.getCurrentConfig();
        const pooled = new PooledTextGeneratorService(config.ai.maxConcurrentRequests);

        await pooled.init();

        // 任务上下文：携带分片索引 + 该片话题数，便于回调对齐
        interface ChunkContext {
            chunkIndex: number;
            topicCount: number;
        }

        const tasks: PooledTask<ChunkContext>[] = [];

        for (let idx = 0; idx < chunks.length; idx++) {
            tasks.push({
                input: await this.memberProfileCtxBuilder.buildCtx(
                    nickname,
                    senderId,
                    knownNicknames,
                    chunks[idx]
                ),
                modelNames: [this.defaultModelName],
                checkJsonFormat: true, // 候选模型链内部对坏 JSON 自动换模型重试（sleep 10s）
                context: { chunkIndex: idx, topicCount: chunks[idx].length }
            });
        }

        // 各分片最终子画像（按 chunkIndex 存放，成功者填入，失败者留 null）
        const subProfiles: unknown[] = new Array(chunks.length).fill(null);
        let completedCount = 0;

        await pooled.submitTasks<ChunkContext>(tasks, async (result: PooledTaskResult<ChunkContext>) => {
            completedCount++;
            const { chunkIndex, topicCount } = result.context;

            // 失败 → 跳过该分片（候选模型链已内部重试过）
            if (!result.isSuccess) {
                this.LOGGER.error(
                    `[${completedCount}/${chunks.length}] 分片${chunkIndex + 1}（${topicCount}话题）生成失败，跳过该分片：` +
                        `${result.error instanceof Error ? result.error.message : String(result.error)}`
                );

                return;
            }

            // 成功：解析子画像
            try {
                subProfiles[chunkIndex] = JSON.parse(result.content!);
                this.LOGGER.success(
                    `[${completedCount}/${chunks.length}] 分片${chunkIndex + 1}（${topicCount}话题）生成成功`
                );
            } catch (e) {
                this.LOGGER.error(
                    `[${completedCount}/${chunks.length}] 分片${chunkIndex + 1} JSON 解析失败，跳过：` +
                        `${e instanceof Error ? e.message : String(e)}`
                );
            }
        });

        pooled.dispose();

        // 过滤出成功的子画像
        const validSubProfiles = subProfiles.filter(p => p !== null);

        this.LOGGER.info(
            `分片生成阶段完成: 成功=${validSubProfiles.length}/${chunks.length}, senderId=${senderId}`
        );

        // 全部分组失败 → 整体失败
        if (validSubProfiles.length === 0) {
            this.LOGGER.error(`所有分片均失败，无法生成画像: senderId=${senderId}`);

            return { success: false, message: `画像生成失败：全部分组（共${chunks.length}组）生成均失败` };
        }

        // 仅 1 组成功 → 直接当作最终结果（无需汇总，省一次 LLM 调用；含 ≤500 单分片场景）
        if (validSubProfiles.length === 1) {
            this.LOGGER.info(`仅1组子画像成功，直接作为最终画像: senderId=${senderId}`);

            return this._storeAndReturn(
                senderId,
                nickname,
                JSON.stringify(validSubProfiles[0]),
                this.defaultModelName,
                total
            );
        }

        // 多组成功 → 汇总（reduce）
        this.LOGGER.info(`开始汇总${validSubProfiles.length}份子画像: senderId=${senderId}`);

        const mergePrompt = await this.memberProfileCtxBuilder.buildMergeCtx(
            nickname,
            knownNicknames,
            validSubProfiles
        );

        let mergedContent = "";
        let selectedModelName = "";

        try {
            const r = await this.TextGeneratorService.generateTextWithModelCandidates(
                [this.defaultModelName],
                mergePrompt,
                true
            );

            mergedContent = r.content;
            selectedModelName = r.selectedModelName;
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);

            this.LOGGER.error(`画像汇总生成失败: ${msg}`);

            return { success: false, message: `画像汇总失败: ${msg}` };
        }

        let mergedProfile: unknown;

        try {
            mergedProfile = JSON.parse(mergedContent);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);

            this.LOGGER.error(`汇总画像 JSON 解析失败: ${msg}`);

            return { success: false, message: `画像格式解析失败: ${msg}` };
        }

        this.LOGGER.success(
            `画像汇总并落库成功: senderId=${senderId}, topicCount=${total}, ` +
                `子画像=${validSubProfiles.length}/${chunks.length}`
        );

        return this._storeAndReturn(senderId, nickname, JSON.stringify(mergedProfile), selectedModelName, total);
    }

    /**
     * 落库 + 返回生成结果（单一口径，被"1 份成功直接落库"与"汇总后落库"两处复用）
     * @param senderId 群友 QQ号
     * @param nickname 群友昵称
     * @param profileJson 画像 JSON 字符串
     * @param modelName 生成所用模型名
     * @param topicCount 话题总数（落库记录的总数，非分片数）
     * @returns 成功结果
     */
    private async _storeAndReturn(
        senderId: string,
        nickname: string,
        profileJson: string,
        modelName: string,
        topicCount: number
    ): Promise<MemberProfileGenerateOutput> {
        const profile = JSON.parse(profileJson);
        const now = Date.now();
        const memberProfile = {
            senderId,
            nickname,
            profileJson,
            modelName,
            topicCount,
            createdAt: now,
            updatedAt: now
        };

        await this.memberProfileDB.storeMemberProfile(memberProfile);

        this.LOGGER.success(`群友画像落库成功: senderId=${senderId}, topicCount=${topicCount}`);

        return {
            success: true,
            profile: profile as MemberProfileGenerateOutput["profile"],
            memberProfile
        };
    }

    /**
     * 收集该群友在所有话题摘要中出现过的全部昵称（按 contributorIDs↔contributors 位置对齐）
     * 同一人改名前后会在不同话题以不同昵称出现，全部收集以消除身份歧义
     * 去重并保持首次出现顺序；全部未命中返回空数组
     * @param digestResults 话题摘要数组
     * @param senderId 目标 QQ号
     */
    private _collectNicknames(
        digestResults: { contributorIDs?: string; contributors?: string }[],
        senderId: string
    ): string[] {
        const seen = new Set<string>();
        const result: string[] = [];

        for (const r of digestResults) {
            try {
                const ids = r.contributorIDs ? (JSON.parse(r.contributorIDs) as string[]) : [];
                const names = r.contributors ? (JSON.parse(r.contributors) as string[]) : [];
                const idx = ids.indexOf(senderId);

                if (idx >= 0 && idx < names.length) {
                    const name = names[idx];

                    if (name && !seen.has(name)) {
                        seen.add(name);
                        result.push(name);
                    }
                }
            } catch {
                // contributorIDs/contributors 可能不是合法 JSON 数组，跳过该条
            }
        }

        return result;
    }

    // ==================== AI 任务接口实现（供 orchestrator 调用） ====================

    /**
     * AI 摘要生成
     */
    public async aiSummarize(input: {
        groupIds: string[];
        startTimeStamp: number;
        endTimeStamp: number;
    }): Promise<AISummarizeOutput> {
        this.LOGGER.info(`收到 aiSummarize 请求: groupIds=${input.groupIds.join(",")}`);

        return this.aiSummarizeTaskHandler.run(input);
    }

    /**
     * 向量嵌入生成
     */
    public async generateEmbedding(input: {
        startTimeStamp: number;
        endTimeStamp: number;
    }): Promise<GenerateEmbeddingOutput> {
        this.LOGGER.info(`收到 generateEmbedding 请求`);

        return this.generateEmbeddingTaskHandler.run(input);
    }

    /**
     * 日报生成
     */
    public async generateReport(input: {
        reportType: "half-daily" | "weekly" | "monthly";
        timeStart: number;
        timeEnd: number;
    }): Promise<GenerateReportOutput> {
        this.LOGGER.info(`收到 generateReport 请求: type=${input.reportType}`);

        return this.generateReportTaskHandler.run(input);
    }

    /**
     * 兴趣度评分
     */
    public async interestScore(input: {
        startTimeStamp: number;
        endTimeStamp: number;
    }): Promise<InterestScoreOutput> {
        this.LOGGER.info(`收到 interestScore 请求`);

        return this.interestScoreTaskHandler.run(input);
    }

    /**
     * LLM 兴趣评估与通知
     */
    public async llmInterestEvaluation(input: {
        startTimeStamp: number;
        endTimeStamp: number;
    }): Promise<LLMInterestEvaluationOutput> {
        this.LOGGER.info(`收到 llmInterestEvaluation 请求`);

        return this.llmInterestEvaluationTaskHandler.run(input);
    }
}
