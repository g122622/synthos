/**
 * Groups 模块模拟数据
 * 用于在只启动前端时展示 UI 效果
 */

import { GroupDetailsRecord, ChatMessage } from "@/types/app";

// 平台类型
const platforms = ["QQ", "微信", "飞书", "钉钉", "Telegram"];

// 分组策略
const splitStrategies = ["realtime", "accumulative"];

// AI 模型
const aiModels = ["gpt-4", "gpt-3.5-turbo", "claude-3", "qwen-max", "glm-4"];

// 群介绍模板
const groupIntroductions = [
    "前端技术交流群，专注于 React、Vue、Angular 等前端框架的学习与分享",
    "后端架构讨论群，涵盖微服务、分布式系统、数据库设计等话题",
    "全栈开发交流群，前后端技术无缝衔接",
    "AI/ML 技术研究群，探索人工智能与机器学习的前沿技术",
    "DevOps 实践群，CI/CD、容器化、自动化运维经验分享",
    "移动开发群，iOS、Android、Flutter、React Native 开发讨论",
    "云原生技术群，Kubernetes、Docker、Service Mesh 学习交流",
    "数据库技术群，MySQL、PostgreSQL、MongoDB、Redis 技术分享",
    "安全技术群，Web 安全、渗透测试、安全开发实践",
    "开源项目协作群，参与开源项目开发与贡献",
    "算法竞赛群，LeetCode、Codeforces 刷题交流",
    "产品设计群，产品经理与设计师的交流空间",
    "测试技术群，自动化测试、性能测试、测试框架分享",
    "区块链技术群，Web3、智能合约、DeFi 技术探讨",
    "游戏开发群，Unity、Unreal、游戏引擎开发交流",
    "嵌入式开发群，单片机、物联网、硬件开发讨论",
    "Python 技术群，Python 全栈开发与数据分析",
    "Java 技术群，Spring Boot、微服务架构实践",
    "Go 语言群，Go 语言高性能服务开发",
    "Rust 技术群，系统编程与 Rust 语言学习"
];

// 生成 20 个群组的 mock 数据
const generateMockGroupDetails = (): GroupDetailsRecord => {
    const groups: GroupDetailsRecord = {};

    for (let i = 1; i <= 20; i++) {
        const groupId = `${100000000 + i * 12345}`; // 生成 9 位群号
        const platformIndex = (i - 1) % platforms.length;
        const strategyIndex = (i - 1) % splitStrategies.length;
        const modelIndex = (i - 1) % aiModels.length;

        groups[groupId] = {
            IM: platforms[platformIndex],
            splitStrategy: splitStrategies[strategyIndex],
            groupIntroduction: groupIntroductions[i - 1],
            aiModel: aiModels[modelIndex]
        };
    }

    return groups;
};

// 模拟群组详情数据
const mockGroupDetails: GroupDetailsRecord = generateMockGroupDetails();

// 生成随机消息发送者
const senderNames = ["张三", "李四", "王五", "赵六", "钱七", "孙八", "周九", "吴十", "郑一", "冯二", "陈三", "楚四", "魏五", "蒋六", "沈七"];

/**
 * 生成指定时间范围内的随机消息
 * @param groupId 群号
 * @param timeStart 开始时间戳
 * @param timeEnd 结束时间戳
 * @returns 消息数组
 */
const generateMockMessages = (groupId: string, timeStart: number, timeEnd: number): ChatMessage[] => {
    const messages: ChatMessage[] = [];
    const duration = timeEnd - timeStart;

    // 根据群号生成一个伪随机种子，使同一个群的消息数量相对固定
    const seed = parseInt(groupId) % 100;
    // 消息数量在 10-150 之间浮动
    const messageCount = 10 + Math.floor((seed / 100) * 140) + Math.floor(Math.random() * 20);

    for (let i = 0; i < messageCount; i++) {
        // 生成随机时间戳，模拟 24 小时内的分布
        // 使用正弦函数模拟工作时间（白天）消息更多的分布
        const randomOffset = Math.random();
        const hourOfDay = randomOffset * 24;
        // 白天（8-22点）消息更多
        const weight = hourOfDay >= 8 && hourOfDay <= 22 ? 0.7 : 0.3;

        let timestamp: number;

        if (Math.random() < weight) {
            // 白天消息
            const dayStart = timeStart + (8 / 24) * duration;
            const dayEnd = timeStart + (22 / 24) * duration;

            timestamp = dayStart + Math.random() * (dayEnd - dayStart);
        } else {
            // 夜间消息
            timestamp = timeStart + Math.random() * duration;
        }

        const senderIndex = Math.floor(Math.random() * senderNames.length);
        const senderId = `sender_${senderIndex + 1}`;
        const senderName = senderNames[senderIndex];

        messages.push({
            msgId: `msg_${groupId}_${i}_${Date.now()}`,
            messageContent: `这是一条来自 ${senderName} 的测试消息 #${i + 1}`,
            groupId,
            timestamp: Math.floor(timestamp),
            senderId,
            senderGroupNickname: senderName,
            senderNickname: senderName,
            quotedMsgId: "",
            sessionId: `session_${groupId}_${Math.floor(i / 10)}`,
            preProcessedContent: ""
        });
    }

    // 按时间戳排序
    messages.sort((a, b) => a.timestamp - b.timestamp);

    return messages;
};

/**
 * 模拟延迟
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 模拟获取群组详情列表
 */
export const mockGetGroupDetails = async (): Promise<ApiResponse<GroupDetailsRecord>> => {
    await delay(300 + Math.random() * 200);

    return {
        success: true,
        data: mockGroupDetails,
        message: ""
    };
};

/**
 * 模拟根据群号获取指定时间范围的聊天消息
 */
export const mockGetChatMessagesByGroupId = async (groupId: string, timeStart: number, timeEnd: number): Promise<ApiResponse<ChatMessage[]>> => {
    await delay(200 + Math.random() * 150);

    // 检查群号是否存在
    if (!mockGroupDetails[groupId]) {
        return {
            success: false,
            data: [],
            message: "群组不存在"
        };
    }

    const messages = generateMockMessages(groupId, timeStart, timeEnd);

    return {
        success: true,
        data: messages,
        message: ""
    };
};
