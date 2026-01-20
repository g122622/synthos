/**
 * 话题引用项
 * 与 RAG references 保持一致：用于 [话题N] 高亮与 ReferenceList 渲染。
 */
export interface TopicReferenceItem {
    topicId: string;
    topic: string;
    relevance: number;
}
