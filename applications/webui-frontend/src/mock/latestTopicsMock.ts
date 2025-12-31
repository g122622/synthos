/**
 * Latest Topics 模块模拟数据
 * 用于在只启动前端时展示 UI 效果
 */

// 技术话题模板 - 提供具体的技术内容
const topicTemplates = [
    {
        topic: "React 18 Concurrent Mode 实践经验分享",
        detail: "讨论了 React 18 中 Concurrent Mode 的新特性，包括 useTransition、useDeferredValue 等 Hook 的使用场景和最佳实践。重点分析了在大型列表渲染场景下如何利用并发渲染提升用户体验，以及如何处理竞态条件问题。",
        contributors: "张三,李四,王五"
    },
    {
        topic: "TypeScript 5.0 类型系统新特性解析",
        detail: "深入探讨了 TypeScript 5.0 中的 const type parameters、decorator metadata、以及新的 satisfies 操作符。分享了在实际项目中如何利用这些新特性提升代码类型安全性和开发效率。",
        contributors: "赵六,钱七"
    },
    {
        topic: "Node.js 性能调优：内存泄漏排查实战",
        detail: "分享了一次线上 Node.js 服务内存泄漏的排查过程。使用 heapdump 和 Chrome DevTools 进行内存快照分析，最终定位到是闭包引用导致的内存未释放问题。讨论了常见的内存泄漏模式和预防措施。",
        contributors: "孙八,周九,吴十"
    },
    {
        topic: "微服务架构下的分布式事务处理方案",
        detail: "对比了 Saga 模式、TCC 模式和基于消息队列的最终一致性方案的优缺点。结合电商订单场景，讨论了如何在保证数据一致性的同时兼顾系统性能和可用性。",
        contributors: "郑一,冯二,陈三"
    },
    {
        topic: "Kubernetes Pod 调度策略深度解析",
        detail: "详细讲解了 K8s 中 NodeSelector、NodeAffinity、PodAffinity/AntiAffinity、Taints 和 Tolerations 等调度机制。分享了在多租户集群中如何合理配置调度策略，实现资源隔离和负载均衡。",
        contributors: "楚四,魏五"
    },
    {
        topic: "前端性能优化：Web Vitals 指标提升实践",
        detail: "围绕 Core Web Vitals（LCP、FID、CLS）进行了深入讨论。分享了通过代码分割、资源预加载、图片懒加载、CSS 优化等手段将 LCP 从 4.2s 降低到 1.8s 的实战经验。",
        contributors: "蒋六,沈七,韩八"
    },
    {
        topic: "GraphQL vs REST API 选型讨论",
        detail: "对比了 GraphQL 和 REST 在不同场景下的适用性。讨论了 GraphQL 的 N+1 查询问题、缓存策略、以及如何通过 DataLoader 优化性能。最终达成共识：移动端场景更适合 GraphQL，而简单的 CRUD 场景 REST 更高效。",
        contributors: "杨九,朱十"
    },
    {
        topic: "Docker 多阶段构建优化镜像体积",
        detail: "分享了将 Node.js 应用镜像从 1.2GB 压缩到 150MB 的实践经验。讨论了多阶段构建、选择合适的基础镜像、清理构建缓存等技巧，以及如何在 CI/CD 流程中优化镜像构建时间。",
        contributors: "秦一,尤二,许三"
    },
    {
        topic: "Vue 3 Composition API 重构实践",
        detail: "分享了将一个大型 Vue 2 项目迁移到 Vue 3 的经验。讨论了如何使用 Composition API 重构复杂的组件逻辑，以及如何利用 VueUse 库提高开发效率。重点讲解了 reactive 和 ref 的使用场景区别。",
        contributors: "何四,吕五"
    },
    {
        topic: "MongoDB 索引优化与查询性能调优",
        detail: "通过 explain() 分析了几个慢查询的执行计划，讨论了复合索引的设计原则、索引覆盖查询的优化技巧。分享了将一个聚合查询从 8 秒优化到 200 毫秒的案例。",
        contributors: "施六,张七,孔八"
    },
    {
        topic: "WebSocket 长连接稳定性优化方案",
        detail: "讨论了 WebSocket 连接在弱网环境下的稳定性问题。分享了心跳检测、断线重连、消息队列缓存等方案的实现细节，以及如何处理消息幂等性和顺序性问题。",
        contributors: "曹九,严十"
    },
    {
        topic: "Rust 与 WebAssembly 在前端的应用探索",
        detail: "介绍了使用 Rust 编译 WebAssembly 模块并在前端调用的完整流程。讨论了 wasm-bindgen 的使用方法，以及在图像处理、加密计算等 CPU 密集型任务中使用 WASM 带来的性能提升。",
        contributors: "金一,魏二,陶三"
    },
    {
        topic: "Redis 集群分布式锁实现方案对比",
        detail: "对比了 SETNX、Redlock、基于 Lua 脚本的分布式锁实现方案。讨论了各种方案在不同故障场景下的表现，以及如何通过看门狗机制解决锁续期问题。",
        contributors: "姜四,戚五,谢六"
    },
    {
        topic: "CI/CD 流水线设计最佳实践",
        detail: "分享了基于 GitLab CI 的流水线设计经验，包括代码检查、单元测试、构建、部署等阶段的配置。讨论了如何通过并行执行、缓存优化等手段将流水线执行时间从 30 分钟缩短到 8 分钟。",
        contributors: "邹七,苏八"
    },
    {
        topic: "Elasticsearch 分词与全文检索优化",
        detail: "讨论了中文分词器 ik_max_word 和 ik_smart 的区别和使用场景。分享了如何通过自定义词典、同义词扩展、拼音搜索等方式提升搜索体验，以及如何设计合理的索引映射。",
        contributors: "潘九,葛十,范一"
    },
    {
        topic: "前端状态管理方案演进：从 Redux 到 Zustand",
        detail: "回顾了前端状态管理方案的演进历程，对比了 Redux、MobX、Recoil、Zustand 等方案的优缺点。讨论了在不同规模项目中如何选择合适的状态管理方案，以及如何实现状态持久化。",
        contributors: "彭二,鲁三,韦四"
    },
    {
        topic: "gRPC 在微服务通信中的实践",
        detail: "介绍了 gRPC 的基本概念和 Protocol Buffers 的使用方法。讨论了 gRPC 与 REST 相比在性能、类型安全、流式通信等方面的优势，以及在实际项目中遇到的负载均衡和服务发现问题。",
        contributors: "昌五,马六"
    },
    {
        topic: "Nginx 反向代理与负载均衡配置实战",
        detail: "分享了 Nginx 作为反向代理和负载均衡器的配置经验。讨论了 upstream 配置、健康检查、会话保持、限流等高级特性，以及如何通过 lua 模块实现动态路由。",
        contributors: "苗七,凤八,花九"
    },
    {
        topic: "Next.js 13 App Router 深度体验",
        detail: "分享了使用 Next.js 13 App Router 重构项目的经验。讨论了 Server Components、Streaming、Route Handlers 等新特性的使用方法，以及在 SEO 优化和性能提升方面的实际效果。",
        contributors: "方十,俞一,任二"
    },
    {
        topic: "Python 异步编程：asyncio 实战指南",
        detail: "讲解了 Python asyncio 的核心概念，包括事件循环、协程、Task 和 Future。分享了在高并发爬虫场景中使用 aiohttp 和 asyncio 的实战经验，以及常见的死锁和性能陷阱。",
        contributors: "袁三,柳四"
    },
    {
        topic: "Prometheus + Grafana 监控体系搭建",
        detail: "介绍了 Prometheus 的数据模型和 PromQL 查询语法。分享了如何使用 Grafana 构建可视化监控面板，以及如何配置 AlertManager 实现告警通知。讨论了自定义 Metrics 的设计原则。",
        contributors: "酆五,鲍六,史七"
    },
    {
        topic: "React Native 新架构 Fabric 解析",
        detail: "深入解析了 React Native 新架构中 Fabric 渲染器的工作原理。讨论了 JSI、TurboModules、Codegen 等新特性带来的性能提升，以及从旧架构迁移的注意事项。",
        contributors: "唐八,费九"
    },
    {
        topic: "Apache Kafka 消息队列设计与实践",
        detail: "讨论了 Kafka 的分区策略、消费者组机制和 offset 管理。分享了在日均千万级消息量场景下的 Kafka 集群运维经验，以及如何处理消息积压和数据丢失问题。",
        contributors: "廉十,岑一,薛二"
    },
    {
        topic: "Tailwind CSS 原子化设计实践",
        detail: "分享了在大型项目中使用 Tailwind CSS 的经验。讨论了如何通过配置自定义主题、提取组件类、使用 @apply 等方式保持代码可维护性，以及 Tailwind 与 CSS-in-JS 方案的对比。",
        contributors: "雷三,贺四,倪五"
    },
    {
        topic: "Go 语言并发编程：channel 与 goroutine",
        detail: "深入讲解了 Go 语言的并发模型，包括 goroutine 调度、channel 通信、select 多路复用等。分享了使用 sync 包、context 包处理并发控制的最佳实践，以及常见的并发陷阱。",
        contributors: "汤六,滕七"
    },
    {
        topic: "OAuth 2.0 与 JWT 认证方案设计",
        detail: "对比了 Session、JWT、OAuth 2.0 等认证方案的优缺点。讨论了 Access Token 和 Refresh Token 的存储策略、Token 黑名单机制的实现，以及如何防范 XSS 和 CSRF 攻击。",
        contributors: "殷八,罗九,毕十"
    },
    {
        topic: "MySQL 8.0 窗口函数使用技巧",
        detail: "介绍了 MySQL 8.0 中新增的窗口函数，包括 ROW_NUMBER、RANK、DENSE_RANK、LAG、LEAD 等。分享了使用窗口函数简化复杂查询的案例，以及与传统子查询方式的性能对比。",
        contributors: "郝一,邬二,安三"
    },
    {
        topic: "Service Mesh Istio 入门与实践",
        detail: "介绍了 Service Mesh 的概念和 Istio 的架构组成。讨论了流量管理、服务发现、负载均衡、熔断降级等功能的配置方法，以及在生产环境中使用 Istio 的经验教训。",
        contributors: "常四,乐五,于六"
    },
    {
        topic: "Web3 智能合约开发入门",
        detail: "介绍了以太坊智能合约的基本概念和 Solidity 语言的语法。讨论了合约的部署、测试、以及常见的安全漏洞（重入攻击、整数溢出等）。分享了使用 Hardhat 开发框架的经验。",
        contributors: "时七,傅八"
    },
    {
        topic: "Flutter 状态管理方案对比分析",
        detail: "对比了 Flutter 中 Provider、Riverpod、Bloc、GetX 等状态管理方案。讨论了各方案在代码组织、测试友好性、性能等方面的差异，以及如何根据项目规模选择合适的方案。",
        contributors: "皮九,卞十,齐一"
    }
];

// 贡献者名单
const contributorPool = [
    "张三",
    "李四",
    "王五",
    "赵六",
    "钱七",
    "孙八",
    "周九",
    "吴十",
    "郑一",
    "冯二",
    "陈三",
    "楚四",
    "魏五",
    "蒋六",
    "沈七",
    "韩八",
    "杨九",
    "朱十",
    "秦一",
    "尤二",
    "许三",
    "何四",
    "吕五",
    "施六",
    "张七",
    "孔八",
    "曹九",
    "严十",
    "金一",
    "魏二",
    "陶三",
    "姜四"
];

// 模拟已读状态存储
const mockReadTopics: Record<string, boolean> = {};

// 模拟收藏状态存储
const mockFavoriteTopics: Record<string, boolean> = {};

// 模拟兴趣得分存储
const mockInterestScores: Record<string, number> = {};

/**
 * 生成伪随机数（基于种子）
 * @param seed 种子值
 * @returns 0-1 之间的伪随机数
 */
const seededRandom = (seed: number): number => {
    const x = Math.sin(seed) * 10000;

    return x - Math.floor(x);
};

/**
 * 基于群组ID和时间范围生成会话ID
 * @param groupId 群组ID
 * @param timeStart 开始时间
 * @param timeEnd 结束时间
 * @returns 会话ID数组
 */
const generateSessionIdsForGroup = (groupId: string, timeStart: number, timeEnd: number): string[] => {
    const seed = parseInt(groupId) % 1000;
    const sessionCount = 5 + Math.floor(seededRandom(seed) * 6); // 5-10 个会话
    const sessionIds: string[] = [];
    const duration = timeEnd - timeStart;

    for (let i = 0; i < sessionCount; i++) {
        // 为每个会话生成唯一ID
        const sessionTime = timeStart + Math.floor((i / sessionCount) * duration);
        const sessionId = `session_${groupId}_${sessionTime}_${i}`;

        sessionIds.push(sessionId);
    }

    return sessionIds;
};

/**
 * 模拟延迟
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 模拟根据群组ID和时间范围获取会话ID
 */
export const mockGetSessionIdsByGroupIdsAndTimeRange = async (groupIds: string[], timeStart: number, timeEnd: number): Promise<ApiResponse<{ groupId: string; sessionIds: string[] }[]>> => {
    await delay(300 + Math.random() * 200);

    const result = groupIds.map(groupId => ({
        groupId,
        sessionIds: generateSessionIdsForGroup(groupId, timeStart, timeEnd)
    }));

    return {
        success: true,
        data: result,
        message: ""
    };
};

/**
 * 模拟获取会话时间范围
 */
export const mockGetSessionTimeDurations = async (sessionIds: string[]): Promise<ApiResponse<{ sessionId: string; timeStart: number; timeEnd: number }[]>> => {
    await delay(200 + Math.random() * 150);

    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    const result = sessionIds.map((sessionId, index) => {
        // 从会话ID中提取时间信息，如果解析失败则使用默认时间
        const parts = sessionId.split("_");
        let baseTime = now - (24 - index) * oneHour;

        if (parts.length >= 3) {
            const parsedTime = parseInt(parts[2]);

            if (!isNaN(parsedTime)) {
                baseTime = parsedTime;
            }
        }

        const duration = oneHour + Math.floor(Math.random() * 2 * oneHour); // 1-3小时

        return {
            sessionId,
            timeStart: baseTime,
            timeEnd: baseTime + duration
        };
    });

    return {
        success: true,
        data: result,
        message: ""
    };
};

/**
 * 为会话生成话题
 * @param sessionId 会话ID
 * @returns 话题数组
 */
const generateTopicsForSession = (
    sessionId: string
): {
    topicId: string;
    sessionId: string;
    topic: string;
    contributors: string;
    detail: string;
}[] => {
    const seed = sessionId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const topicCount = 2 + Math.floor(seededRandom(seed) * 4); // 2-5 个话题
    const topics = [];

    for (let i = 0; i < topicCount; i++) {
        const templateIndex = Math.floor(seededRandom(seed + i) * topicTemplates.length);
        const template = topicTemplates[templateIndex];

        // 生成随机贡献者
        const contributorCount = 2 + Math.floor(seededRandom(seed + i + 100) * 3); // 2-4 个贡献者
        const shuffledContributors = [...contributorPool].sort(() => seededRandom(seed + i) - 0.5);
        const contributors = shuffledContributors.slice(0, contributorCount).join(",");

        const topicId = `topic_${sessionId}_${i}`;

        // 为新话题生成兴趣得分（80% 的话题有得分），范围为 -1 到 1
        if (seededRandom(seed + i + 200) < 0.8) {
            // 生成 -1 到 1 之间的得分，保留两位小数
            mockInterestScores[topicId] = Math.round((seededRandom(seed + i + 300) * 2 - 1) * 100) / 100;
        }

        topics.push({
            topicId,
            sessionId,
            topic: template.topic,
            contributors,
            detail: template.detail
        });
    }

    return topics;
};

/**
 * 模拟根据会话ID获取AI摘要结果
 */
export const mockGetAIDigestResultsBySessionIds = async (
    sessionIds: string[]
): Promise<ApiResponse<{ sessionId: string; result: { topicId: string; sessionId: string; topic: string; contributors: string; detail: string }[] }[]>> => {
    await delay(400 + Math.random() * 300);

    const result = sessionIds.map(sessionId => ({
        sessionId,
        result: generateTopicsForSession(sessionId)
    }));

    return {
        success: true,
        data: result,
        message: ""
    };
};

/**
 * 模拟获取兴趣得分结果
 */
export const mockGetInterestScoreResults = async (topicIds: string[]): Promise<ApiResponse<{ topicId: string; score: number | null }[]>> => {
    await delay(200 + Math.random() * 100);

    const result = topicIds.map(topicId => {
        // 如果已经有缓存的得分，使用缓存；否则生成新得分
        if (mockInterestScores[topicId] !== undefined) {
            return {
                topicId,
                score: mockInterestScores[topicId]
            };
        }

        // 80% 的概率有得分
        const seed = topicId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

        if (seededRandom(seed) < 0.8) {
            // 生成 -1 到 1 之间的得分，保留两位小数
            const score = Math.round((seededRandom(seed + 1) * 2 - 1) * 100) / 100;

            mockInterestScores[topicId] = score;

            return { topicId, score };
        }

        return { topicId, score: null };
    });

    return {
        success: true,
        data: result,
        message: ""
    };
};

/**
 * 模拟标记话题为已读
 */
export const mockMarkTopicAsRead = async (topicId: string): Promise<ApiResponse<{ message: string }>> => {
    await delay(150 + Math.random() * 100);

    mockReadTopics[topicId] = true;

    return {
        success: true,
        data: { message: "话题已标记为已读" },
        message: ""
    };
};

/**
 * 模拟清除话题已读状态
 */
export const mockUnmarkTopicAsRead = async (topicId: string): Promise<ApiResponse<{ message: string }>> => {
    await delay(150 + Math.random() * 100);

    delete mockReadTopics[topicId];

    return {
        success: true,
        data: { message: "话题已读状态已清除" },
        message: ""
    };
};

/**
 * 模拟批量检查话题已读状态
 */
export const mockGetTopicsReadStatus = async (topicIds: string[]): Promise<ApiResponse<{ readStatus: Record<string, boolean> }>> => {
    await delay(200 + Math.random() * 100);

    const readStatus: Record<string, boolean> = {};

    for (const topicId of topicIds) {
        readStatus[topicId] = mockReadTopics[topicId] === true;
    }

    return {
        success: true,
        data: { readStatus },
        message: ""
    };
};

/**
 * 模拟标记话题为收藏
 */
export const mockMarkTopicAsFavorite = async (topicId: string): Promise<ApiResponse<{ message: string }>> => {
    await delay(150 + Math.random() * 100);

    mockFavoriteTopics[topicId] = true;

    return {
        success: true,
        data: { message: "话题已添加到收藏" },
        message: ""
    };
};

/**
 * 模拟从收藏中移除话题
 */
export const mockRemoveTopicFromFavorites = async (topicId: string): Promise<ApiResponse<{ message: string }>> => {
    await delay(150 + Math.random() * 100);

    delete mockFavoriteTopics[topicId];

    return {
        success: true,
        data: { message: "话题已从收藏中移除" },
        message: ""
    };
};

/**
 * 模拟批量检查话题收藏状态
 */
export const mockGetTopicsFavoriteStatus = async (topicIds: string[]): Promise<ApiResponse<{ favoriteStatus: Record<string, boolean> }>> => {
    await delay(200 + Math.random() * 100);

    const favoriteStatus: Record<string, boolean> = {};

    for (const topicId of topicIds) {
        favoriteStatus[topicId] = mockFavoriteTopics[topicId] === true;
    }

    return {
        success: true,
        data: { favoriteStatus },
        message: ""
    };
};
