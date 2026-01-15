import { CtxTemplateNode } from "../../template/CtxTemplate";
import { CtxMiddleware } from "../container/container";
import { ContentUtils } from "../../template/ContentUtils";
import ConfigManagerService from "@root/common/services/config/ConfigManagerService";
import Logger from "@root/common/util/Logger";

// 第一个key是关键词，第二个是相关解释
export type KnowledgeBase = Map<string[], string[]>;

// 注入背景知识
export const addBackgroundKnowledgeMiddleware: CtxMiddleware = async rootNode => {
    const config = await ConfigManagerService.getCurrentConfig();

    if (!config.ai.context.backgroundKnowledge.enabled) {
        return rootNode;
    }

    const fullText = rootNode.serializeToString().toLowerCase();
    const knowledgeBase: KnowledgeBase = new Map(
        (config.ai.context.backgroundKnowledge.knowledgeBase || []).map(item => [item[0], item[1]])
    );
    const results = [] as string[];

    // 遍历知识库，找到匹配的关键词
    for (const [keywords, explanations] of knowledgeBase) {
        for (const keyword of keywords) {
            if (fullText.includes(keyword.toLowerCase())) {
                results.push(`关键词：${keywords.toString()}, 解释：${explanations.join("")}`);
                break;
            }
        }
    }

    // 只取前 N 条，防止内容过多
    const maxEntries = config.ai.context.backgroundKnowledge.maxKnowledgeEntries;
    if (results.length > maxEntries) {
        Logger.warning(`背景知识匹配到的条目过多，已截断为前 ${maxEntries} 条`);
        results.splice(maxEntries);
    }

    // 将背景知识作为新的节点插入到上下文树的开头
    if (results.length > 0) {
        rootNode.insertChildNodeToFront(
            new CtxTemplateNode()
                .setTitle("背景知识(由系统仅根据关键词自动匹配得出，因此可能不准确)")
                .setContentText(ContentUtils.unorderedList(results))
        );
    }
    return rootNode;
};
