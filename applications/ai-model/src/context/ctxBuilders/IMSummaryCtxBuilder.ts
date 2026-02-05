import { ProcessedChatMessageWithRawMessage } from "@root/common/contracts/data-provider";
import { Disposable } from "@root/common/util/lifecycle/Disposable";
import { mustInitBeforeUse } from "@root/common/util/lifecycle/mustInitBeforeUse";

import { IMPromptStore } from "../prompts/IMPromptStore";

import { ICtxBuilder } from "./contracts/ICtxBuilder";

@mustInitBeforeUse
export class IMSummaryCtxBuilder extends Disposable implements ICtxBuilder {
    async init(): Promise<void> {}
    async buildCtx(messages: ProcessedChatMessageWithRawMessage[], groupIntroduction: string): Promise<string> {
        let content = "";

        for (const message of messages) {
            content += message.preProcessedContent + "\n";
        }

        return (await IMPromptStore.getSummarizePrompt(groupIntroduction, 50, content)).serializeToString();
    }
}
