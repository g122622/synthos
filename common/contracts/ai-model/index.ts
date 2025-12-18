export interface AIDigestResult {
    topicId: string; // 主题id
    sessionId: string; // 摘要所属会话id
    topic: string; // 摘要主题
    contributors: string; // 摘要贡献者
    detail: string; // 摘要详情正文部分
    modelName: string; // 生成摘要所使用的AI模型名称
    updateTime: number; // 摘要更新时间，UNIX毫秒时间戳格式
}
