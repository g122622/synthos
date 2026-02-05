/**
 * SQL 查询工具
 * 允许 Agent 直接查询聊天记录数据库
 * 注意：当前版本未实现安全限制，仅用于演示
 */
import { injectable, inject } from "tsyringe";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { COMMON_TOKENS } from "@root/common/di/tokens";
import Logger from "@root/common/util/Logger";

import { ToolDefinition, ToolExecutor } from "../contracts/tools";

/**
 * SQL 查询工具参数
 */
interface SQLQueryParams {
    /** SQL 查询语句 */
    query: string;
    /** 结果数量限制 */
    limit?: number;
}

/**
 * SQL 查询工具
 */
@injectable()
export class SQLQueryTool {
    private LOGGER = Logger.withTag("SQLQueryTool");

    public constructor(@inject(COMMON_TOKENS.ImDbAccessService) private imDB: ImDbAccessService) {}

    /**
     * 获取工具定义
     */
    public getDefinition(): ToolDefinition {
        return {
            type: "function",
            function: {
                name: "sql_query",
                description:
                    "直接查询聊天记录数据库。可用于统计分析、精确查询等场景。\n" +
                    "数据库表结构：\n" +
                    "- chat_messages: 聊天消息表，包含字段 msgId, messageContent, groupId, timestamp, senderId, senderGroupNickname, senderNickname 等\n" +
                    "注意：仅支持 SELECT 查询，不支持 UPDATE/DELETE/DROP 等操作",
                parameters: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description:
                                "SQL SELECT 查询语句，例如：SELECT * FROM chat_messages WHERE groupId = '...' LIMIT 10"
                        },
                        limit: {
                            type: "number",
                            description: "结果数量限制，默认 100，最大 1000",
                            default: 100
                        }
                    },
                    required: ["query"]
                }
            }
        };
    }

    /**
     * 执行 SQL 查询
     */
    public getExecutor(): ToolExecutor<SQLQueryParams> {
        return async (params: SQLQueryParams) => {
            const { query, limit = 100 } = params;
            const actualLimit = Math.min(limit, 1000);

            this.LOGGER.info(`执行 SQL 查询: ${query.substring(0, 200)}...`);

            try {
                // TODO: 未来版本需要添加安全检查：
                // 1. 检查是否为 SELECT 语句
                // 2. 检查是否访问了白名单表
                // 3. 防止 SQL 注入
                // 4. 限制查询复杂度和执行时间

                // 简单的安全检查：仅允许 SELECT
                const normalizedQuery = query.trim().toLowerCase();

                if (!normalizedQuery.startsWith("select")) {
                    throw new Error("仅支持 SELECT 查询");
                }

                // 检查危险关键字
                const dangerousKeywords = ["drop", "delete", "update", "insert", "alter", "create", "truncate"];

                for (const keyword of dangerousKeywords) {
                    if (normalizedQuery.includes(keyword)) {
                        throw new Error(`不允许使用关键字: ${keyword.toUpperCase()}`);
                    }
                }

                // 自动添加 LIMIT 限制
                let finalQuery = query.trim();

                if (!normalizedQuery.includes("limit")) {
                    finalQuery += ` LIMIT ${actualLimit}`;
                } else {
                    // 替换 LIMIT 值为 actualLimit（如果原 LIMIT 更大）
                    finalQuery = finalQuery.replace(/LIMIT\s+\d+/gi, `LIMIT ${actualLimit}`);
                }

                // 执行查询（直接访问内部的 db 实例）
                // TODO: 这里需要 ImDbAccessService 提供一个公共的 query 方法
                // 目前通过反射访问私有属性（临时方案）
                const db = (this.imDB as any).db;
                const results = await db.all(finalQuery, []);

                this.LOGGER.info(`SQL 查询完成，返回 ${results.length} 条结果`);

                return {
                    rowCount: results.length,
                    rows: results
                };
            } catch (error) {
                this.LOGGER.error(`SQL 查询失败: ${error}`);
                throw error;
            }
        };
    }
}
