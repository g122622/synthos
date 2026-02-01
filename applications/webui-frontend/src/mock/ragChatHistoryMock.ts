/**
 * RAG 聊天历史模拟数据
 * 用于在只启动前端时展示 UI 效果
 */

import type { ApiResponse } from "@/types/api";

import { SessionListItem, SessionDetail, ReferenceItem, SessionListResponse } from "@/api/ragChatHistoryApi";

// 模拟会话数据存储（用于模拟增删改操作）
let mockSessions: SessionDetail[] = [
    {
        id: "session-001",
        title: "React 18 新特性讨论",
        question: "React 18 有哪些重要的新特性？",
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
        ],
        topK: 5,
        createdAt: Date.now() - 86400000 * 7,
        updatedAt: Date.now() - 86400000 * 7,
        enableQueryRewriter: true
    },
    {
        id: "session-002",
        title: "TypeScript 类型技巧",
        question: "TypeScript 有哪些高级类型技巧？",
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
        ],
        topK: 5,
        createdAt: Date.now() - 86400000 * 6,
        updatedAt: Date.now() - 86400000 * 6,
        enableQueryRewriter: true
    },
    {
        id: "session-003",
        title: "前端性能优化方案",
        question: "如何进行前端性能优化？",
        answer: `根据群聊记录中关于性能优化的讨论：

**优化策略：**
1. **代码分割**：使用动态 import 实现按需加载
2. **虚拟滚动**：处理大列表时使用虚拟滚动库
3. **图片优化**：使用 WebP 格式、懒加载、响应式图片

**工具推荐：**
- Lighthouse：全面的性能审计工具
- Web Vitals：核心性能指标监控
- Bundle Analyzer：分析打包体积`,
        references: [
            { topicId: "topic-003", topic: "前端性能优化实践", relevance: 0.94 },
            { topicId: "topic-004", topic: "Vite vs Webpack 构建工具对比", relevance: 0.72 }
        ],
        topK: 5,
        createdAt: Date.now() - 86400000 * 5,
        updatedAt: Date.now() - 86400000 * 5,
        enableQueryRewriter: true
    },
    {
        id: "session-004",
        title: "Vite 和 Webpack 对比",
        question: "Vite 和 Webpack 有什么区别，该如何选择？",
        answer: `根据群聊记录中关于构建工具的讨论：

**Vite 优势：**
1. 开发环境启动速度极快（基于 ESM）
2. 热更新速度快
3. 配置相对简单

**Webpack 优势：**
1. 生态成熟，插件丰富
2. 对复杂场景支持更好
3. 社区资源丰富

**选择建议：**
- 新项目推荐使用 Vite
- 大型企业级项目可考虑 Webpack
- 需要特殊插件时优先考虑 Webpack`,
        references: [
            { topicId: "topic-004", topic: "Vite vs Webpack 构建工具对比", relevance: 0.96 },
            { topicId: "topic-003", topic: "前端性能优化实践", relevance: 0.58 }
        ],
        topK: 5,
        createdAt: Date.now() - 86400000 * 4,
        updatedAt: Date.now() - 86400000 * 4,
        enableQueryRewriter: true
    },
    {
        id: "session-005",
        title: "Node.js 后端架构",
        question: "Node.js 后端项目应该如何设计架构？",
        answer: `根据群聊记录中关于 Node.js 架构的讨论：

**架构设计要点：**
1. **分层架构**：Controller -> Service -> Repository
2. **依赖注入**：使用 IoC 容器管理依赖
3. **错误处理**：统一的错误处理中间件

**框架推荐：**
- NestJS：企业级应用首选
- Fastify：高性能场景
- Express：简单项目或学习使用`,
        references: [
            { topicId: "topic-005", topic: "Node.js 后端架构设计", relevance: 0.93 },
            { topicId: "topic-004", topic: "Vite vs Webpack 构建工具对比", relevance: 0.45 }
        ],
        topK: 5,
        createdAt: Date.now() - 86400000 * 3,
        updatedAt: Date.now() - 86400000 * 3,
        enableQueryRewriter: true
    },
    {
        id: "session-006",
        title: "CSS 现代布局",
        question: "CSS Grid 和 Flexbox 怎么用？",
        answer: `根据群聊记录中关于 CSS 布局的讨论：

**Flexbox 适用场景：**
1. 一维布局（行或列）
2. 内容对齐
3. 响应式组件

**CSS Grid 适用场景：**
1. 二维布局（行和列同时控制）
2. 页面整体布局
3. 复杂的网格系统

**最佳实践：**
- 两者可以结合使用
- Grid 用于整体布局，Flexbox 用于组件内部`,
        references: [
            { topicId: "topic-006", topic: "CSS 现代布局技术", relevance: 0.91 },
            { topicId: "topic-003", topic: "前端性能优化实践", relevance: 0.42 }
        ],
        topK: 5,
        createdAt: Date.now() - 86400000 * 2,
        updatedAt: Date.now() - 86400000 * 2,
        enableQueryRewriter: true
    },
    {
        id: "session-007",
        title: "AI 编程工具使用",
        question: "GitHub Copilot 好用吗？",
        answer: `根据群聊记录中关于 AI 工具的讨论：

**GitHub Copilot 优点：**
1. 代码补全准确度高
2. 支持多种编程语言
3. 能够理解上下文

**使用建议：**
- 适合写重复性代码
- 需要人工审查生成的代码
- 对于复杂业务逻辑仍需人工编写

**其他工具推荐：**
- ChatGPT：适合问答和学习
- Cursor：集成 AI 的编辑器`,
        references: [
            { topicId: "topic-007", topic: "AI 辅助编程工具体验", relevance: 0.94 },
            { topicId: "topic-002", topic: "TypeScript 类型体操技巧", relevance: 0.38 }
        ],
        topK: 5,
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now() - 86400000,
        enableQueryRewriter: true
    },
    {
        id: "session-008",
        title: "微前端架构实践",
        question: "微前端怎么实现？有哪些方案？",
        answer: `根据群聊记录中关于微前端的讨论：

**主流方案：**
1. **qiankun**：基于 single-spa，阿里开源
2. **Module Federation**：Webpack 5 原生支持
3. **iframe**：最简单但体验较差

**适用场景：**
- 大型单体应用拆分
- 多团队协作开发
- 技术栈统一困难

**注意事项：**
- 通信机制设计
- 样式隔离
- 公共依赖处理`,
        references: [
            { topicId: "topic-008", topic: "微前端架构实践", relevance: 0.95 },
            { topicId: "topic-005", topic: "Node.js 后端架构设计", relevance: 0.52 }
        ],
        topK: 5,
        createdAt: Date.now() - 43200000,
        updatedAt: Date.now() - 43200000,
        enableQueryRewriter: true
    },
    {
        id: "session-009",
        title: "状态管理方案选择",
        question: "React 项目应该用什么状态管理库？",
        answer: `根据群聊记录中关于状态管理的讨论：

**主流方案对比：**
1. **Redux**：经典方案，生态丰富，适合大型项目
2. **Zustand**：轻量简洁，学习成本低
3. **Jotai**：原子化状态管理
4. **React Query**：服务端状态管理

**选择建议：**
- 简单项目：useState + useContext
- 中型项目：Zustand
- 大型项目：Redux Toolkit
- 服务端状态为主：React Query`,
        references: [
            { topicId: "topic-001", topic: "React 18 新特性讨论", relevance: 0.78 },
            { topicId: "topic-003", topic: "前端性能优化实践", relevance: 0.65 }
        ],
        topK: 5,
        createdAt: Date.now() - 21600000,
        updatedAt: Date.now() - 21600000,
        enableQueryRewriter: true
    },
    {
        id: "session-010",
        title: "单元测试最佳实践",
        question: "前端项目如何做好单元测试？",
        answer: `根据群聊记录中关于测试的讨论：

**测试框架选择：**
1. **Jest**：最流行的测试框架
2. **Vitest**：与 Vite 配合更好
3. **Testing Library**：推荐的组件测试方案

**测试策略：**
- 优先测试业务逻辑
- 组件测试关注用户行为
- Mock 外部依赖

**覆盖率目标：**
- 核心业务代码 80% 以上
- 工具函数 100%
- UI 组件适度测试`,
        references: [
            { topicId: "topic-002", topic: "TypeScript 类型体操技巧", relevance: 0.62 },
            { topicId: "topic-004", topic: "Vite vs Webpack 构建工具对比", relevance: 0.55 }
        ],
        topK: 5,
        createdAt: Date.now() - 3600000,
        updatedAt: Date.now() - 3600000,
        enableQueryRewriter: true
    }
];

/**
 * 模拟网络延迟
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 生成唯一 ID
 */
const generateId = () => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * 从问题中提取标题（取前20个字符）
 */
const generateTitle = (question: string): string => {
    const title = question.replace(/[？?。.！!]/g, "").trim();

    return title.length > 20 ? title.substring(0, 20) + "..." : title;
};

/**
 * mock 专用：在 mock /api/ask 成功后，将该次问答追加进历史记录
 */
export const mockAppendSessionFromAsk = (input: { question: string; answer: string; references: ReferenceItem[]; topK: number; enableQueryRewriter: boolean }): string => {
    const now = Date.now();
    const id = generateId();
    const newSession: SessionDetail = {
        id,
        title: generateTitle(input.question),
        question: input.question,
        answer: input.answer,
        references: input.references,
        topK: input.topK,
        createdAt: now,
        updatedAt: now,
        enableQueryRewriter: input.enableQueryRewriter,
        isFailed: false,
        failReason: ""
    };

    // 添加到列表开头
    mockSessions.unshift(newSession);

    return id;
};

/**
 * 模拟获取会话列表 API
 */
export const mockGetSessionList = async (limit: number, offset: number): Promise<ApiResponse<SessionListResponse>> => {
    await delay(200 + Math.random() * 200);

    // 按更新时间倒序排列
    const sortedSessions = [...mockSessions].sort((a, b) => b.updatedAt - a.updatedAt);

    const sessions: SessionListItem[] = sortedSessions.slice(offset, offset + limit).map(session => ({
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        isFailed: !!session.isFailed
    }));

    return {
        success: true,
        data: {
            sessions,
            total: mockSessions.length,
            hasMore: offset + limit < mockSessions.length
        },
        message: ""
    };
};

/**
 * 模拟获取会话详情 API
 */
export const mockGetSessionDetail = async (sessionId: string): Promise<ApiResponse<SessionDetail>> => {
    await delay(200 + Math.random() * 200);

    const session = mockSessions.find(s => s.id === sessionId);

    if (!session) {
        return {
            success: false,
            data: null as unknown as SessionDetail,
            message: "会话不存在"
        };
    }

    return {
        success: true,
        data: session,
        message: ""
    };
};

/**
 * 模拟删除会话 API
 */
export const mockDeleteSession = async (sessionId: string): Promise<ApiResponse<void>> => {
    await delay(200 + Math.random() * 200);

    const index = mockSessions.findIndex(s => s.id === sessionId);

    if (index === -1) {
        return {
            success: false,
            data: undefined as unknown as void,
            message: "会话不存在"
        };
    }

    mockSessions.splice(index, 1);

    return {
        success: true,
        data: undefined as unknown as void,
        message: ""
    };
};

/**
 * 模拟更新会话标题 API
 */
export const mockUpdateSessionTitle = async (sessionId: string, title: string): Promise<ApiResponse<void>> => {
    await delay(200 + Math.random() * 200);

    const session = mockSessions.find(s => s.id === sessionId);

    if (!session) {
        return {
            success: false,
            data: undefined as unknown as void,
            message: "会话不存在"
        };
    }

    session.title = title;
    session.updatedAt = Date.now();

    return {
        success: true,
        data: undefined as unknown as void,
        message: ""
    };
};

/**
 * 模拟清空所有会话 API
 */
export const mockClearAllSessions = async (): Promise<ApiResponse<void>> => {
    await delay(300 + Math.random() * 200);

    mockSessions = [];

    return {
        success: true,
        data: undefined as unknown as void,
        message: ""
    };
};

/**
 * 模拟切换会话置顶状态 API
 */
export const mockToggleSessionPin = async (sessionId: string, pinned: boolean): Promise<ApiResponse<void>> => {
    await delay(200 + Math.random() * 200);

    const session = mockSessions.find(s => s.id === sessionId);

    if (!session) {
        return {
            success: false,
            data: undefined as unknown as void,
            message: "会话不存在"
        };
    }

    session.pinned = pinned;
    session.updatedAt = Date.now();

    return {
        success: true,
        data: undefined as unknown as void,
        message: pinned ? "会话已置顶" : "会话已取消置顶"
    };
};
