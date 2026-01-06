import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import { ICtxBuilder } from "./contracts/ICtxBuilder";
import { RagPromptStore } from "../prompts/RagPromptStore";
import { Disposable } from "@root/common/util/lifecycle/Disposable";
import { AgcDbAccessService } from "@root/common/services/database/AgcDbAccessService";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { formatTimestamp } from "@root/common/util/TimeUtils";
import { SearchOutput } from "@root/common/rpc/ai-model";
import { AI_MODEL_TOKENS } from "../../di/tokens";

/**
 * RAG 上下文构建器
 * 负责构建 RAG 问答的上下文提示词
 * 
 * 注意：由于使用 DI 容器管理，不再使用 @mustInitBeforeUse 装饰器
 * 初始化责任由 RagRPCImpl.init() 调用
 */
@injectable()
export class RAGCtxBuilder extends Disposable implements ICtxBuilder {
    /**
     * 构造函数
     * @param agcDB AGC 数据库访问服务
     * @param imDB IM 数据库访问服务
     */
    public constructor(
        @inject(AI_MODEL_TOKENS.AgcDbAccessService) private agcDB: AgcDbAccessService,
        @inject(AI_MODEL_TOKENS.ImDbAccessService) private imDB: ImDbAccessService
    ) {
        super();
    }

    /**
     * 初始化方法
     */
    public async init(): Promise<void> {}

    /**
     * 构建 RAG 上下文
     * @param question 用户问题
     * @param searchResults 搜索结果
     * @param currentDate 当前日期字符串
     * @returns 构建的提示词
     */
    public async buildCtx(
        question: string,
        searchResults: SearchOutput,
        currentDate: string
    ): Promise<string> {
        // 获取话题日期信息
        const topicDates: { [index: string]: { startTime?: string; endTime?: string } } = {};

        for (let i = 0; i < searchResults.length; i++) {
            const result = searchResults[i];
            const indexStr = String(i + 1); // 使用索引作为键

            const digest = await this.agcDB.getAIDigestResultByTopicId(result.topicId!);
            if (digest && digest.sessionId) {
                const timeRange = await this.imDB.getSessionTimeDuration(digest.sessionId);
                if (timeRange) {
                    topicDates[indexStr] = {
                        startTime: formatTimestamp(timeRange.timeStart),
                        endTime: formatTimestamp(timeRange.timeEnd)
                    };
                }
            }
        }

        // 构建格式化的话题内容
        const formattedTopics = searchResults
            .map((r, i) => {
                const index = i + 1;
                const indexStr = String(index);
                let topicStr = `【话题${index}:${r.topic}】\n【参与者:${r.contributors}】`;

                // 如果有日期信息，添加起止时间
                if (
                    topicDates[indexStr] &&
                    topicDates[indexStr].startTime &&
                    topicDates[indexStr].endTime
                ) {
                    topicStr += `\n【起止时间:${topicDates[indexStr].startTime}至${topicDates[indexStr].endTime}】`;
                }

                topicStr += `\n${r.detail}`;
                return topicStr;
            })
            .join("\n\n");

        return RagPromptStore.getRagAnswerPrompt(question, formattedTopics, currentDate);
    }
}
