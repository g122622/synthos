import { TextGenerator } from "./generators/text/TextGenerator";
import { IMCtxBuilder } from "./context/ctxBuilders/IMCtxBuilder";
import { AIDigestResult } from "@root/common/types/ai-model";
import { AGCDBManager } from "@root/common/database/AGCDBManager";
import { IMDBManager } from "@root/common/database/IMDBManager";
import { getHoursAgoTimestamp } from "@root/common/util/TimeUtils";
import Logger from "@root/common/util/Logger";
import { ProcessedChatMessageWithRawMessage } from "@root/common/types/data-provider";

(async () => {
    const textGenerator = new TextGenerator();
    await textGenerator.init();
    const ctxBuilder = new IMCtxBuilder();
    await ctxBuilder.init();
    const agcDBManager = new AGCDBManager();
    await agcDBManager.init();
    const imdbManager = new IMDBManager();
    await imdbManager.init();

    const msgs = await imdbManager.getProcessedChatMessageWithRawMessageByGroupIdAndTimeRange(
        "738075190",
        getHoursAgoTimestamp(12),
        Date.now()
    );
    Logger.info(`获取到 ${msgs.length} 条消息`);
    // 按照 sessionId 分组
    const groups = msgs.reduce(
        (acc, msg) => {
            const { sessionId } = msg;
            if (!acc[sessionId]) {
                acc[sessionId] = [];
            }
            acc[sessionId].push(msg);
            return acc;
        },
        {} as Record<string, ProcessedChatMessageWithRawMessage[]>
    );
    Logger.info(`分组完成，共 ${Object.keys(groups).length} 组`);
    // 遍历每个分组
    for (const sessionId in groups) {
        const group = groups[sessionId];
        const ctx = await ctxBuilder.buildCtx(group);
        Logger.info(`构建上下文成功，长度为 ${ctx.length}`);
        const resultStr = await textGenerator.generateText("doubao-1-5-lite-32k-250115", ctx);
        let results: Omit<AIDigestResult, "sessionId">[] = [];
        try {
            results = JSON.parse(resultStr);
        } catch (error) {
            Logger.error(`解析摘要失败：${error}，跳过当前会话`);
            continue; // 跳过当前会话
        }
        Logger.info(`生成摘要成功！`);
        console.dir(results);
        for (const result of results) {
            Object.assign(result, { sessionId }); // 添加 sessionId
            result.contributors = JSON.stringify(result.contributors); // 转换为字符串
        }
        await agcDBManager.storeAIDigestResults(results as AIDigestResult[]);
        Logger.info(`存储摘要成功！`);
    }
})();
