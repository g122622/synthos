import { ICtxBuilder } from "./contracts/ICtxBuilder";
import { RagPromptStore } from "../prompts/RagPromptStore";
import { Disposable } from "@root/common/util/lifecycle/Disposable";
import { mustInitBeforeUse } from "@root/common/util/lifecycle/mustInitBeforeUse";

@mustInitBeforeUse
export class RAGCtxBuilder extends Disposable implements ICtxBuilder {
    async init(): Promise<void> {}
    async buildCtx(
        question: string,
        topics: string,
        currentDate?: string,
        topicDates?: { [topicId: string]: { startTime: string; endTime: string } }
    ): Promise<string> {
        return RagPromptStore.getRagPrompt(question, topics, currentDate, topicDates);
    }
}
