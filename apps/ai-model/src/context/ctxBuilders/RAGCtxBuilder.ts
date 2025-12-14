import { ICtxBuilder } from "./contracts/ICtxBuilder";
import { RagPromptStore } from "../prompts/RagPromptStore";
import { Disposable } from "@root/common/util/lifecycle/Disposable";
import { mustInitBeforeUse } from "@root/common/util/lifecycle/mustInitBeforeUse";
import { AGCDBManager } from "@root/common/database/AGCDBManager";
import { IMDBManager } from "@root/common/database/IMDBManager";
import { formatTimestamp } from "@root/common/util/TimeUtils";
import { SearchOutput } from "@root/common/rpc/ai-model";

@mustInitBeforeUse
export class RAGCtxBuilder extends Disposable implements ICtxBuilder {
    async init(): Promise<void> {}
    
    async buildCtx(
        question: string,
        searchResults: SearchOutput,
        currentDate: string,
        agcDB: AGCDBManager,
        imDB: IMDBManager
    ): Promise<string> {
        // 获取话题日期信息
        const topicDates: { [index: string]: { startTime?: string; endTime?: string } } = {};
        
        for (let i = 0; i < searchResults.length; i++) {
            const result = searchResults[i];
            const indexStr = String(i + 1); // 使用索引作为键
            
            const digest = await agcDB.getAIDigestResultByTopicId(result.topicId);
            if (digest && digest.sessionId) {
                const timeRange = await imDB.getSessionTimeDuration(digest.sessionId);
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
                if (topicDates[indexStr] && topicDates[indexStr].startTime && topicDates[indexStr].endTime) {
                    topicStr += `\n【起止时间:${topicDates[indexStr].startTime}至${topicDates[indexStr].endTime}】`;
                }
                
                topicStr += `\n${r.detail}`;
                return topicStr;
            })
            .join("\n\n");
        
        return RagPromptStore.getRagPrompt(question, formattedTopics, currentDate);
    }
}
