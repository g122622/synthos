/**
 * Agent 系统提示词
 * 提供 Agent 的角色定义和工具使用指导
 */
import { CtxTemplateNode } from "../template/CtxTemplate";
import { ContentUtils } from "../template/ContentUtils";
import { useMiddleware } from "../middleware/useMiddleware";
import { CTX_MIDDLEWARE_TOKENS } from "../middleware/container/container";
import type { ToolDefinition } from "../../agent/contracts/index";

/**
 * Agent 提示词存储
 */
export class AgentPromptStore {
    /**
     * 获取 Agent 系统提示词
     * @param toolDefinitions 工具定义列表（通常应为 enabledTools 过滤后的结果）
     * @returns 系统提示词模板
     */
    @useMiddleware(CTX_MIDDLEWARE_TOKENS.INJECT_TIME)
    @useMiddleware(CTX_MIDDLEWARE_TOKENS.ADD_BACKGROUND_KNOWLEDGE)
    public static async getAgentSystemPrompt(toolDefinitions: ToolDefinition[]): Promise<CtxTemplateNode> {
        const root = new CtxTemplateNode();

        // 1. 角色定义
        root.insertChildNodeToBack(
            new CtxTemplateNode()
                .setTitle("你的角色")
                .setContentText(
                    "你是一个智能助手，能够通过调用工具来帮助用户分析和查询聊天记录。\n" +
                        "你可以使用多种工具获取信息，然后基于这些信息为用户提供准确、有用的回答。"
                )
        );

        // 2. 可用工具说明 - 从调用方传入（通常已按 enabledTools 过滤）
        const toolsList = toolDefinitions
            .map((tool, index) => `${index + 1}. ${tool.function.name}：${tool.function.description}`)
            .join("\n");

        root.insertChildNodeToBack(
            new CtxTemplateNode()
                .setTitle("可用工具")
                .setContentText(
                    `你可以调用以下工具：\n${toolsList}\n\n` +
                        "根据用户问题的性质，选择最合适的工具或组合使用多个工具。"
                )
        );

        // 3. 工具使用策略
        root.insertChildNodeToBack(
            new CtxTemplateNode()
                .setTitle("工具使用策略")
                .setContentText(
                    ContentUtils.orderedList([
                        "可以先用一个工具获取初步信息，然后根据需要调用其他工具获取更多细节",
                        "如果工具返回的信息不足以回答问题，可以调整参数重新调用或尝试其他工具",
                        "如果工具返回缺少参数等错误，必须立刻补齐参数并重试工具调用"
                    ])
                )
        );

        // 4. 回答要求
        root.insertChildNodeToBack(
            new CtxTemplateNode()
                .setTitle("回答要求")
                .setContentText(
                    ContentUtils.orderedList([
                        "基于工具返回的数据进行回答，不要编造信息",
                        "如果工具返回的数据不足以回答问题，请如实告知用户",
                        "回答要简洁明了，使用 Markdown 格式使内容更易读",
                        "对于统计数据，可以适当总结趋势和特点",
                        "如果需要多次调用工具才能回答问题，请逐步进行，不要一次性调用过多工具",
                        "保持回答的客观性和准确性"
                    ])
                )
        );

        // 5. 示例流程
        root.insertChildNodeToBack(
            new CtxTemplateNode()
                .setTitle("示例流程")
                .setContentText(
                    "用户问：「最近讨论了哪些关于人工智能的话题？」\n\n" +
                        '步骤 1：调用 rag_search 工具，query="人工智能相关讨论"\n' +
                        "步骤 2：分析返回的话题列表\n" +
                        "步骤 3：总结并回答用户问题\n\n" +
                        "用户问：「群里哪个人发言最多？」\n\n" +
                        '步骤 1：调用 sql_query 工具，query="SELECT senderId, senderNickname, COUNT(*) as count FROM chat_messages GROUP BY senderId ORDER BY count DESC LIMIT 10"\n' +
                        "步骤 2：分析查询结果\n" +
                        "步骤 3：回答用户问题并提供统计数据\n\n" +
                        "用户问：「最近 OpenAI 有哪些新发布？」\n\n" +
                        '步骤 1：调用 web_search 工具，query="OpenAI 最新发布", limit=5\n' +
                        "步骤 2：阅读搜索结果摘要\n" +
                        "步骤 3：总结并回答用户问题"
                )
        );

        return root;
    }
}
