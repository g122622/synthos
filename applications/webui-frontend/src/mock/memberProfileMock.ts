/**
 * 群友画像模块模拟数据
 * 用于在只启动前端时展示 UI 效果
 */
import type { MemberProfile, GenerateMemberProfileRequest } from "@/types/memberProfile";
import type { AIDigestResult } from "@/types/topic";
import type { ApiResponse } from "@/types/api";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 内存缓存：senderId → 画像记录（模拟落库复用）
const mockProfileStore: Map<string, MemberProfile> = new Map();

/**
 * 模拟查询缓存画像
 */
export const mockGetMemberProfile = async (senderId: string): Promise<ApiResponse<MemberProfile | null>> => {
    await delay(300 + Math.random() * 200);

    return {
        success: true,
        data: mockProfileStore.get(senderId) ?? null,
        message: ""
    };
};

/**
 * 模拟反查依据话题
 */
export const mockGetContributorTopics = async (senderId: string): Promise<ApiResponse<AIDigestResult[]>> => {
    await delay(300 + Math.random() * 200);

    const now = Date.now();
    const topics: AIDigestResult[] = [
        {
            topicId: `mock_topic_${senderId}_1`,
            sessionId: `mock_session_${senderId}_1`,
            topic: "讨论某框架的并发模型与适用场景",
            contributors: JSON.stringify(["测试群友", "群友A", "群友B"]),
            detail: "测试群友分享了关于某框架并发模型的理解，认为其适合 IO 密集型场景，并提到了在生产环境的实践经验。",
            modelName: "mock-model",
            updateTime: now - 3600_000,
            hasEmbedding: true,
            contributorIDs: JSON.stringify([senderId, "10001", "10002"])
        },
        {
            topicId: `mock_topic_${senderId}_2`,
            sessionId: `mock_session_${senderId}_2`,
            topic: "求职面试经验交流",
            contributors: JSON.stringify(["测试群友", "群友C"]),
            detail: "测试群友讲述了自己秋招时投递某互联网公司的经历，提到了项目深挖与系统设计题的准备方式。",
            modelName: "mock-model",
            updateTime: now - 7200_000,
            hasEmbedding: true,
            contributorIDs: JSON.stringify([senderId, "10003"])
        },
        {
            topicId: `mock_topic_${senderId}_3`,
            sessionId: `mock_session_${senderId}_3`,
            topic: "某技术领域的最新进展探讨",
            contributors: JSON.stringify(["测试群友", "群友D"]),
            detail: "测试群友介绍了该领域近期的一篇论文，并表达了对工程落地可行性的关注。",
            modelName: "mock-model",
            updateTime: now - 10800_000,
            hasEmbedding: true,
            contributorIDs: JSON.stringify([senderId, "10004"])
        }
    ];

    return {
        success: true,
        data: topics,
        message: ""
    };
};

/**
 * 模拟画像生成（非流式，直接返回完整画像）
 */
export const mockGenerateMemberProfile = async (request: GenerateMemberProfileRequest): Promise<ApiResponse<MemberProfile | null>> => {
    await delay(1500 + Math.random() * 800);

    const profile = {
        school: "某高校计算机相关专业",
        company: "某互联网公司（后端方向）",
        domain: "分布式系统 / 高并发服务",
        experience: "有秋招求职经历，关注系统设计题与项目深挖",
        interests: "关注框架并发模型、技术领域前沿论文与工程落地",
        communicationStyle: "偏理性分析，乐于分享实践经验"
    };

    // 落库（模拟）
    const now = Date.now();
    const record: MemberProfile = {
        senderId: request.senderId,
        nickname: request.nickname ?? null,
        profileJson: JSON.stringify(profile),
        modelName: "mock-model",
        topicCount: 3,
        createdAt: now,
        updatedAt: now
    };

    mockProfileStore.set(request.senderId, record);

    return {
        success: true,
        data: record,
        message: ""
    };
};
