import { IMDBManager } from "@root/common/database/IMDBManager";
import { getHoursAgoTimestamp } from "@root/common/util/TimeUtils";
import { FixedSplitter } from "./splitters/FixedSplitter";
import Logger from "@root/common/util/Logger";
import { ProcessedChatMessage } from "@root/common/types/data-provider";
import { formatMsg } from "./formatMsg,";

(async () => {
    const imdbManager = new IMDBManager();
    await imdbManager.init();
    const splitter = new FixedSplitter();
    await splitter.init();

    const results = await imdbManager.getRawChatMessagesByGroupIdAndTimeRange("738075190", getHoursAgoTimestamp(12), Date.now());
    const splitResultMap = await splitter.split(results);
    const preProcessedResults: ProcessedChatMessage[] = []
    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const sessionId = splitResultMap.get(result.msgId);
        preProcessedResults.push({
            msgId: result.msgId,
            sessionId: sessionId!,
            preProcessedContent: formatMsg(result)
        })
    }
    await imdbManager.storeProcessedChatMessages(preProcessedResults);

    await imdbManager.close();
})();
