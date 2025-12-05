import { ProcessedChatMessageWithRawMessage } from "@root/common/contracts/data-provider";
import { ICtxBuilder } from "./@types/ICtxBuilder";
import { IMPromptStore } from "../prompts/IMPromptStore";
import { Disposable } from "@root/common/util/lifecycle/Disposable";

export class IMSummaryCtxBuilder extends Disposable implements ICtxBuilder {
    async init(): Promise<void> {}
    async buildCtx(
        messages: ProcessedChatMessageWithRawMessage[],
        groupIntroduction: string
    ): Promise<string> {
        let content = "";
        for (const message of messages) {
            content += message.preProcessedContent + "\n";
        }
        return IMPromptStore.getSummarizePrompt(groupIntroduction, 50, content);
    }
}
