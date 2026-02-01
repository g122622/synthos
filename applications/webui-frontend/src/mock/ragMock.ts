/**
 * RAG 模拟数据
 * 用于在只启动前端时展示 UI 效果
 */

import type { ApiResponse } from "@/types/api";

import { SearchResultItem, AskResponse } from "@/api/ragApi";
import { mockAppendSessionFromAsk } from "@/mock/ragChatHistoryMock";

// 模拟的话题数据
const mockTopics: SearchResultItem[] = [
    {
        topicId: "topic-001",
        topic: "React 18 新特性讨论",
        detail: "群友们讨论了 React 18 的新特性，包括 Concurrent Mode、Suspense 改进、自动批处理等。大家普遍认为新的并发渲染机制能够显著提升用户体验，但同时也带来了一些学习成本。",
        distance: 0.15,
        contributors: "张三, 李四, 王五"
    },
    {
        topicId: "topic-002",
        topic: "TypeScript 类型体操技巧",
        detail: "分享了一些高级 TypeScript 类型技巧，如条件类型、映射类型、模板字面量类型等。讨论了如何在实际项目中合理使用这些特性，避免过度复杂化代码。",
        distance: 0.22,
        contributors: "李四, 赵六"
    },
    {
        topicId: "topic-003",
        topic: "前端性能优化实践",
        detail: "讨论了前端性能优化的各种方案，包括代码分割、懒加载、虚拟滚动、图片优化等。分享了使用 Lighthouse 进行性能审计的经验。",
        distance: 0.28,
        contributors: "王五, 钱七, 孙八"
    },
    {
        topicId: "topic-004",
        topic: "Vite vs Webpack 构建工具对比",
        detail: "对比了 Vite 和 Webpack 两种构建工具的优缺点。Vite 在开发环境下启动速度更快，但 Webpack 生态更加成熟。讨论了不同场景下的选择建议。",
        distance: 0.32,
        contributors: "张三, 周九"
    },
    {
        topicId: "topic-005",
        topic: "Node.js 后端架构设计",
        detail: "讨论了 Node.js 后端项目的架构设计，包括分层架构、依赖注入、错误处理、日志记录等最佳实践。推荐了 NestJS 框架作为企业级应用的选择。",
        distance: 0.35,
        contributors: "李四, 吴十"
    },
    {
        topicId: "topic-006",
        topic: "CSS 现代布局技术",
        detail: "分享了 CSS Grid 和 Flexbox 的高级用法，讨论了响应式设计的最佳实践。介绍了 Container Queries 等新特性。",
        distance: 0.38,
        contributors: "赵六, 钱七"
    },
    {
        topicId: "topic-007",
        topic: "AI 辅助编程工具体验",
        detail: "讨论了 GitHub Copilot、ChatGPT 等 AI 辅助编程工具的使用体验。大家分享了各自的使用技巧和注意事项，认为 AI 工具能显著提升开发效率。",
        distance: 0.41,
        contributors: "张三, 王五, 周九"
    },
    {
        topicId: "topic-008",
        topic: "微前端架构实践",
        detail: "讨论了微前端架构的实现方案，包括 qiankun、Module Federation 等。分析了微前端的适用场景和潜在问题。",
        distance: 0.45,
        contributors: "李四, 孙八"
    }
];

// 模拟的问答回复
const mockAnswers: Record<string, AskResponse> = {
    default: {
        answer: `根据群聊记录，我找到了一些相关的讨论内容：

**主要观点：**
1. 群友们对这个话题有着丰富的讨论
2. 大家分享了各自的实践经验和见解
3. 讨论中提到了多种解决方案和最佳实践

**总结：**
这是一个在技术社区中经常被讨论的话题，群友们提供了很多有价值的见解和实践经验。建议结合具体的项目需求来选择合适的方案。`,
        references: [
            { topicId: "topic-001", topic: "React 18 新特性讨论", relevance: 0.85 },
            { topicId: "topic-002", topic: "TypeScript 类型体操技巧", relevance: 0.72 },
            { topicId: "topic-003", topic: "前端性能优化实践", relevance: 0.65 }
        ]
    },
    react: {
        answer: `根据群聊记录中关于 React 的讨论：

**React 18 新特性：**
1. **Concurrent Mode**：新的并发渲染机制，能够让 React 在渲染过程中被打断，提升用户体验
2. **自动批处理**：React 18 会自动批处理多个状态更新，减少不必要的重渲染
3. **Suspense 改进**：更好地支持数据获取和代码分割场景

**群友建议：**
- 新项目建议直接使用 React 18
- 旧项目升级需要注意 StrictMode 的变化
- 并发特性需要逐步学习和应用`,
        references: [
            { topicId: "topic-001", topic: "React 18 新特性讨论", relevance: 0.95 },
            { topicId: "topic-003", topic: "前端性能优化实践", relevance: 0.68 }
        ]
    },
    typescript: {
        answer: `根据群聊记录中关于 TypeScript 的讨论：

**类型体操技巧：**
1. **条件类型**：使用 \`extends\` 关键字实现类型条件判断
2. **映射类型**：通过 \`in keyof\` 遍历对象类型的键
3. **模板字面量类型**：TypeScript 4.1 引入，可以进行字符串类型操作

**最佳实践：**
- 避免过度复杂的类型定义
- 善用 \`infer\` 关键字进行类型推断
- 适当使用 \`any\` 和 \`unknown\` 保持灵活性`,
        references: [
            { topicId: "topic-002", topic: "TypeScript 类型体操技巧", relevance: 0.92 },
            { topicId: "topic-001", topic: "React 18 新特性讨论", relevance: 0.55 }
        ]
    },
    performance: {
        answer: `根据群聊记录中关于性能优化的讨论：

**优化策略：**
1. **代码分割**：使用动态 import 实现按需加载
2. **虚拟滚动**：处理大列表时使用虚拟滚动库
3. **图片优化**：使用 WebP 格式、懒加载、响应式图片

**工具推荐：**
- Lighthouse：全面的性能审计工具
- Web Vitals：核心性能指标监控
- Bundle Analyzer：分析打包体积

**关键指标：**
- LCP (Largest Contentful Paint) < 2.5s
- FID (First Input Delay) < 100ms
- CLS (Cumulative Layout Shift) < 0.1`,
        references: [
            { topicId: "topic-003", topic: "前端性能优化实践", relevance: 0.94 },
            { topicId: "topic-004", topic: "Vite vs Webpack 构建工具对比", relevance: 0.72 }
        ]
    }
};

/**
 * 模拟搜索延迟
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 模拟搜索 API
 */
export const mockSearch = async (query: string, limit: number = 10): Promise<ApiResponse<SearchResultItem[]>> => {
    await delay(500 + Math.random() * 500); // 模拟网络延迟

    // 简单的关键词匹配
    const keywords = query.toLowerCase().split(/\s+/);
    const results = mockTopics
        .filter(topic => {
            const text = `${topic.topic} ${topic.detail}`.toLowerCase();

            return keywords.some(keyword => text.includes(keyword));
        })
        .slice(0, limit);

    // 如果没有匹配结果，返回部分默认数据
    const finalResults = results.length > 0 ? results : mockTopics.slice(0, Math.min(limit, 3));

    return {
        success: true,
        data: finalResults,
        message: ""
    };
};

/**
 * 模拟问答 API
 */
export const mockAsk = async (question: string, topK: number = 5): Promise<ApiResponse<AskResponse>> => {
    await delay(1000 + Math.random() * 1000); // 模拟网络延迟（问答通常更慢）

    const lowerQuestion = question.toLowerCase();

    // 根据问题关键词选择合适的回答
    let response: AskResponse;

    if (lowerQuestion.includes("react")) {
        response = mockAnswers.react;
    } else if (lowerQuestion.includes("typescript") || lowerQuestion.includes("类型")) {
        response = mockAnswers.typescript;
    } else if (lowerQuestion.includes("性能") || lowerQuestion.includes("优化") || lowerQuestion.includes("performance")) {
        response = mockAnswers.performance;
    } else {
        response = mockAnswers.default;
    }

    // 限制引用数量
    const limitedReferences = response.references.slice(0, topK);

    const sessionId = mockAppendSessionFromAsk({
        question,
        answer: response.answer,
        references: limitedReferences,
        topK,
        enableQueryRewriter: true
    });

    return {
        success: true,
        data: {
            answer: response.answer,
            references: limitedReferences,
            sessionId
        },
        message: ""
    };
};
