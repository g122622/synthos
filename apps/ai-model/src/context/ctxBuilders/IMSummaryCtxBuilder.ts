import { ProcessedChatMessageWithRawMessage } from "@root/common/types/data-provider";
import { ICtxBuilder } from "./@types/ICtxBuilder";
import { IMPromptStore } from "../prompts/IMPromptStore";

export class IMSummaryCtxBuilder implements ICtxBuilder {
    async init(): Promise<void> {}
    async buildCtx(
        messages: ProcessedChatMessageWithRawMessage[],
        groupIntroduction: string
    ): Promise<string> {
        let content = "";
        for (const message of messages) {
            content += message.preProcessedContent + "\n";
        }
        return IMPromptStore.getSummarizePrompt(groupIntroduction, 20, content);
    }
    async close(): Promise<void> {}
}
