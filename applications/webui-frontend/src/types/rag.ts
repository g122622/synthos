/**
 * RAG相关的类型定义
 */

/**
 * 引用项
 */
export interface ReferenceItem {
    topicId: string;
    topic: string;
    relevance: number;
}

/**
 * 搜索结果项
 */
export interface SearchResultItem {
    topicId: string;
    topic: string;
    detail: string;
    distance: number;
    contributors: string;
}

/**
 * 搜索响应
 */
export type SearchResponse = SearchResultItem[];

/**
 * 问答响应
 */
export interface AskResponse {
    answer: string;
    references: ReferenceItem[];
    sessionId?: string;
}

/**
 * 会话列表项
 */
export interface SessionListItem {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    isFailed?: boolean;
}

/**
 * 会话详情
 */
export interface SessionDetail {
    id: string;
    title: string;
    question: string;
    answer: string;
    references: ReferenceItem[];
    topK: number;
    enableQueryRewriter: boolean;
    isFailed?: boolean;
    failReason?: string;
    createdAt: number;
    updatedAt: number;
}

/**
 * 会话列表响应
 */
export interface SessionListResponse {
    sessions: SessionListItem[];
    total: number;
    hasMore: boolean;
}

/**
 * 扩展的会话列表项（用于前端展示，添加置顶标记）
 */
export interface ExtendedSessionListItem extends SessionListItem {
    pinned?: boolean;
    [key: string]: unknown;
}
