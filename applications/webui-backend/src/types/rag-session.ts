/**
 * RAG 会话相关类型定义
 */
import type { ReferenceItem } from "@root/common/rpc/ai-model/index";

/**
 * RAG 会话记录
 */
export interface RagChatSession {
    id: string;
    title: string;
    question: string;
    answer: string;
    refs: string; // JSON 字符串，存储 ReferenceItem[]
    topK: number;
    enableQueryRewriter: boolean;
    isFailed: boolean;
    failReason: string;
    pinned: boolean;
    createdAt: number;
    updatedAt: number;
}

/**
 * 创建会话的输入参数（Repository 层）
 */
export interface CreateSessionInput {
    id: string;
    title: string;
    question: string;
    answer: string;
    refs: string;
    topK: number;
    enableQueryRewriter: boolean;
    isFailed: boolean;
    failReason: string;
    pinned: boolean;
}

/**
 * 会话列表项（用于侧边栏显示）
 */
export interface SessionListItem {
    id: string;
    title: string;
    isFailed: boolean;
    pinned: boolean;
    createdAt: number;
    updatedAt: number;
}

/**
 * 创建会话的输入参数（Service 层）
 */
export interface CreateSessionServiceInput {
    question: string;
    answer: string;
    references: ReferenceItem[];
    topK: number;
    enableQueryRewriter: boolean;

    // 可选：失败标记（用于断线续跑/后台落库场景）
    isFailed?: boolean;
    failReason?: string;
}

/**
 * 会话详情（用于前端展示）
 */
export interface SessionDetail {
    id: string;
    title: string;
    question: string;
    answer: string;
    references: ReferenceItem[];
    topK: number;
    enableQueryRewriter: boolean;
    isFailed: boolean;
    failReason: string;
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
