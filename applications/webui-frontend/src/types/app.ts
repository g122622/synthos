/**
 * 应用相关的类型定义
 * 注意：具体的业务类型已迁移到各自的分类文件中：
 * - 群组相关: types/group.ts
 * - 聊天相关: types/chat.ts
 * - 话题相关: types/topic.ts
 * - RAG相关: types/rag.ts
 * - Agent相关: types/agent.ts
 * - 报告相关: types/report.ts
 */

// 为了保持向后兼容，这里重新导出常用类型
export type { GroupDetail, GroupDetailsRecord } from "./group";
export type { ChatMessage } from "./chat";
export type { AIDigestResult, TopicItem } from "./topic";
