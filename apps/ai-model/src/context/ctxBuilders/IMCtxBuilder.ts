import { ProcessedChatMessageWithRawMessage } from "@root/common/types/data-provider";
import { ICtxBuilder } from "./@types/ICtxBuilder";
import { IMPromptStore } from "../prompts/IMPromptStore";

export class IMCtxBuilder implements ICtxBuilder {
    async init(): Promise<void> {}
    async buildCtx(messages: ProcessedChatMessageWithRawMessage[]): Promise<string> {
        let content = "";
        for (const message of messages) {
            content += message.preProcessedContent + "\n";
        }
        return IMPromptStore.getSummarizePrompt(20, content);
    }
    async close(): Promise<void> {}
}
