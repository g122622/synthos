interface TopicItem {
    topicId: string;
    sessionId: string;
    topic: string;
    contributors: string;
    detail: string;
    timeStart: number; // 改为 number 以统一时间戳
    timeEnd: number;
    groupId: string; // 添加groupId字段
}

export default TopicItem;
