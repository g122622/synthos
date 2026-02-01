/**
 * Groups 模块模拟数据
 * 用于在只启动前端时展示 UI 效果
 */

import type { ApiResponse } from "@/types/api";
import type { GroupDetailsRecord } from "@/types/group";
import type { ChatMessage } from "@/types/chat";

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
        // Generate 9-10 digit numeric ID, less than 2^32 (4294967296)
        // Range: 100000000 (9 digits) to 4294967295 (max 10 digits < 2^32)
        const senderId = `${100000000 + Math.floor(Math.random() * (4294967295 - 100000000))}`;
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

/**
 * 模拟 Chat Messages FTS 搜索
 */
export const mockChatMessagesFtsSearch = async (params: {
    query: string;
    groupIds?: string[];
    timeStart?: number;
    timeEnd?: number;
    page: number;
    pageSize: number;
}): Promise<
    ApiResponse<{
        total: number;
        page: number;
        pageSize: number;
        groups: Array<{ groupId: string; count: number; hits: Array<{ msgId: string; timestamp: number; snippet: string }> }>;
    }>
> => {
    await delay(220 + Math.random() * 150);

    void params;

    return {
        success: true,
        data: { total: 0, page: params.page, pageSize: params.pageSize, groups: [] },
        message: ""
    };
};

/**
 * 模拟 FTS 上下文
 */
export const mockGetChatMessagesFtsContext = async (params: { groupId: string; msgId: string; before: number; after: number }): Promise<ApiResponse<ChatMessage[]>> => {
    await delay(200 + Math.random() * 120);

    void params;

    return {
        success: true,
        data: [],
        message: ""
    };
};

/**
 * 生成整点对齐的时间戳数组
 * @param periodStart 周期开始时间戳
 * @returns 24个整点时间戳数组
 */
const generateAlignedTimestamps = (periodStart: number): number[] => {
    const timestamps: number[] = [];

    for (let i = 0; i < 24; i++) {
        timestamps.push(periodStart + i * 60 * 60 * 1000);
    }

    return timestamps;
};

/**
 * 根据群号生成伪随机的每小时消息数量
 * @param groupId 群号
 * @param hourIndex 小时索引
 * @param isCurrentPeriod 是否是当前周期（用于区分当前和前一天）
 * @returns 该小时的消息数量
 */
const generateHourlyCount = (groupId: string, hourIndex: number, isCurrentPeriod: boolean): number => {
    // 使用群号作为随机种子
    const seed = parseInt(groupId) % 100;
    const periodFactor = isCurrentPeriod ? 1 : 0.8; // 前一天的消息量稍少

    // 模拟工作时间（8-22点）消息更多的分布
    const hour = hourIndex;
    let baseCount: number;

    if (hour >= 8 && hour <= 22) {
        // 工作时间消息量更大
        baseCount = Math.floor((seed / 100) * 15) + Math.floor(Math.random() * 10) + 3;
    } else {
        // 非工作时间消息量较少
        baseCount = Math.floor((seed / 100) * 5) + Math.floor(Math.random() * 3);
    }

    return Math.floor(baseCount * periodFactor);
};

/**
 * 模拟获取多个群组的每小时消息统计（包括当前24小时和前一天24小时）
 */
export const mockGetMessageHourlyStats = async (
    groupIds: string[]
): Promise<
    ApiResponse<{
        data: Record<string, { current: number[]; previous: number[] }>;
        timestamps: { current: number[]; previous: number[] };
        totalCounts: { current: number; previous: number };
    }>
> => {
    await delay(300 + Math.random() * 200);

    // 计算时间范围（整点对齐）
    const now = new Date();
    const currentHourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0).getTime();

    // 当前24小时：从23小时前的整点到当前小时整点
    const currentPeriodStart = currentHourStart - 23 * 60 * 60 * 1000;
    // 前一天24小时
    const previousPeriodStart = currentPeriodStart - 24 * 60 * 60 * 1000;

    // 生成时间戳数组
    const currentTimestamps = generateAlignedTimestamps(currentPeriodStart);
    const previousTimestamps = generateAlignedTimestamps(previousPeriodStart);

    // 构建结果数据
    const data: Record<string, { current: number[]; previous: number[] }> = {};
    let currentTotal = 0;
    let previousTotal = 0;

    for (const groupId of groupIds) {
        // 检查群号是否存在
        if (!mockGroupDetails[groupId]) {
            data[groupId] = {
                current: new Array(24).fill(0),
                previous: new Array(24).fill(0)
            };
            continue;
        }

        const currentHourly: number[] = [];
        const previousHourly: number[] = [];

        for (let i = 0; i < 24; i++) {
            const currentCount = generateHourlyCount(groupId, i, true);
            const previousCount = generateHourlyCount(groupId, i, false);

            currentHourly.push(currentCount);
            previousHourly.push(previousCount);

            currentTotal += currentCount;
            previousTotal += previousCount;
        }

        data[groupId] = {
            current: currentHourly,
            previous: previousHourly
        };
    }

    return {
        success: true,
        data: {
            data,
            timestamps: {
                current: currentTimestamps,
                previous: previousTimestamps
            },
            totalCounts: {
                current: currentTotal,
                previous: previousTotal
            }
        },
        message: ""
    };
};
