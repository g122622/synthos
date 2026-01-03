/**
 * 日报模拟数据
 * 用于在只启动前端时展示 UI 效果
 */

import { Report, ReportType, ReportsPaginatedResponse, TriggerReportGenerateResponse } from "@/api/reportApi";

// 当前时间戳
const now = Date.now();
const oneHour = 60 * 60 * 1000;
const oneDay = 24 * oneHour;

// 模拟的日报数据
const mockReports: Report[] = [
    {
        reportId: "report-001",
        type: "half-daily",
        timeStart: now - 6 * oneHour,
        timeEnd: now,
        isEmpty: false,
        summary: `今天上午群里的讨论非常活跃，主要围绕以下几个话题展开：

**1. React 18 新特性**
群友们对 React 18 的 Concurrent Mode 进行了深入讨论，大家普遍认为新的并发渲染机制能够显著提升用户体验，但同时也带来了一些学习成本。

**2. TypeScript 类型技巧**
分享了一些高级 TypeScript 类型技巧，包括条件类型、映射类型等。讨论了如何在实际项目中合理使用这些特性。

**3. 前端性能优化**
讨论了代码分割、懒加载、虚拟滚动等性能优化方案，分享了使用 Lighthouse 进行性能审计的经验。

整体来看，今天上午的讨论质量较高，技术深度适中，适合各层次开发者参与。`,
        summaryGeneratedAt: now - 30 * 60 * 1000,
        summaryStatus: "success",
        model: "gpt-4",
        statistics: {
            topicCount: 15,
            mostActiveGroups: ["前端技术交流群", "React 学习群", "TypeScript 爱好者"],
            mostActiveHour: 10
        },
        topicIds: ["topic-001", "topic-002", "topic-003", "topic-004", "topic-005"],
        createdAt: now - 30 * 60 * 1000,
        updatedAt: now - 30 * 60 * 1000
    },
    {
        reportId: "report-002",
        type: "half-daily",
        timeStart: now - 18 * oneHour,
        timeEnd: now - 12 * oneHour,
        isEmpty: false,
        summary: `昨天下午的群聊主要集中在后端技术讨论：

**1. Node.js 性能调优**
讨论了 Node.js 应用的性能优化策略，包括集群模式、内存管理、事件循环优化等。

**2. 数据库设计**
分享了 MongoDB 和 PostgreSQL 的选型经验，讨论了不同场景下的数据库设计最佳实践。

**3. API 设计规范**
讨论了 RESTful API 和 GraphQL 的优缺点，分享了 API 版本管理的经验。

下午时段参与讨论的群友较多，技术讨论氛围良好。`,
        summaryGeneratedAt: now - 12 * oneHour,
        summaryStatus: "success",
        model: "gpt-4",
        statistics: {
            topicCount: 12,
            mostActiveGroups: ["Node.js 开发群", "后端架构讨论"],
            mostActiveHour: 15
        },
        topicIds: ["topic-006", "topic-007", "topic-008"],
        createdAt: now - 12 * oneHour,
        updatedAt: now - 12 * oneHour
    },
    {
        reportId: "report-003",
        type: "half-daily",
        timeStart: now - oneDay - 6 * oneHour,
        timeEnd: now - oneDay,
        isEmpty: false,
        summary: `前天上午的讨论主要围绕开发工具和效率提升：

**1. VSCode 插件推荐**
群友们分享了各自常用的 VSCode 插件，包括 GitLens、Prettier、ESLint 等。

**2. AI 辅助编程**
讨论了 GitHub Copilot 和 ChatGPT 在编程中的应用，分享了使用技巧。

**3. Git 工作流**
讨论了 Git Flow 和 GitHub Flow 的选择，分享了代码审查的最佳实践。`,
        summaryGeneratedAt: now - oneDay,
        summaryStatus: "success",
        model: "gpt-3.5-turbo",
        statistics: {
            topicCount: 8,
            mostActiveGroups: ["开发工具交流群"],
            mostActiveHour: 9
        },
        topicIds: ["topic-009", "topic-010"],
        createdAt: now - oneDay,
        updatedAt: now - oneDay
    },
    {
        reportId: "report-004",
        type: "half-daily",
        timeStart: now - oneDay - 18 * oneHour,
        timeEnd: now - oneDay - 12 * oneHour,
        isEmpty: true,
        summary: "",
        summaryGeneratedAt: now - oneDay - 12 * oneHour,
        summaryStatus: "success",
        model: "",
        statistics: {
            topicCount: 0,
            mostActiveGroups: [],
            mostActiveHour: 0
        },
        topicIds: [],
        createdAt: now - oneDay - 12 * oneHour,
        updatedAt: now - oneDay - 12 * oneHour
    },
    {
        reportId: "report-005",
        type: "weekly",
        timeStart: now - 7 * oneDay,
        timeEnd: now,
        isEmpty: false,
        summary: `本周技术讨论总结：

## 热门话题

### 前端技术
- React 18 新特性深入讨论，包括 Concurrent Mode、Suspense 等
- Vue 3 Composition API 实践经验分享
- 前端工程化和构建工具的选型讨论

### 后端技术
- Node.js 性能优化和内存管理
- 微服务架构设计和服务拆分策略
- 数据库选型和性能调优

### 开发效率
- AI 辅助编程工具的使用体验
- 代码审查和 Git 工作流最佳实践
- 单元测试和 E2E 测试的实践

## 本周亮点
本周讨论最为活跃的是 React 18 相关话题，共有 45 条相关讨论，参与人数达 23 人。

## 建议
建议继续关注前端框架的新特性，同时加强对后端架构的学习。`,
        summaryGeneratedAt: now - 2 * oneHour,
        summaryStatus: "success",
        model: "gpt-4",
        statistics: {
            topicCount: 89,
            mostActiveGroups: ["前端技术交流群", "React 学习群", "Node.js 开发群"],
            mostActiveHour: 14
        },
        topicIds: ["topic-001", "topic-002", "topic-003", "topic-006", "topic-007"],
        createdAt: now - 2 * oneHour,
        updatedAt: now - 2 * oneHour
    },
    {
        reportId: "report-006",
        type: "weekly",
        timeStart: now - 14 * oneDay,
        timeEnd: now - 7 * oneDay,
        isEmpty: false,
        summary: `上周技术讨论回顾：

## 主要话题

### 架构设计
- 微前端架构实践经验分享
- 领域驱动设计（DDD）入门讨论
- 系统可观测性建设

### 云原生技术
- Docker 和 Kubernetes 入门教程分享
- CI/CD 流水线搭建经验
- 服务网格（Service Mesh）介绍

### 团队协作
- 敏捷开发实践分享
- 技术文档编写规范讨论
- 知识管理工具推荐

上周整体讨论氛围良好，话题覆盖面广，适合团队学习参考。`,
        summaryGeneratedAt: now - 7 * oneDay,
        summaryStatus: "success",
        model: "gpt-4",
        statistics: {
            topicCount: 76,
            mostActiveGroups: ["架构设计群", "DevOps 交流群"],
            mostActiveHour: 11
        },
        topicIds: ["topic-011", "topic-012", "topic-013"],
        createdAt: now - 7 * oneDay,
        updatedAt: now - 7 * oneDay
    },
    {
        reportId: "report-007",
        type: "monthly",
        timeStart: now - 30 * oneDay,
        timeEnd: now,
        isEmpty: false,
        summary: `本月技术社区月度总结：

## 话题概览

本月共产生 **312** 个话题讨论，涵盖前端、后端、DevOps、架构设计等多个领域。

## 热门方向

### 1. 前端技术（占比 35%）
- React 18 新特性是本月最热门话题
- Vue 3 生态持续完善
- 前端工程化工具链讨论活跃

### 2. 后端技术（占比 28%）
- Node.js 性能优化受到广泛关注
- Go 语言入门讨论增多
- 数据库优化是持续热点

### 3. DevOps（占比 20%）
- 容器化部署成为主流
- CI/CD 自动化程度提升
- 可观测性建设受到重视

### 4. 软技能（占比 17%）
- 团队协作方法论讨论
- 职业发展规划分享
- 技术写作能力培养

## 社区活跃度

本月参与讨论的活跃用户 **156** 人，较上月增长 12%。讨论高峰期集中在工作日的 10:00-11:00 和 14:00-15:00。

## 下月展望

预计下月 React 19 beta 发布后，相关讨论会持续增加。建议大家提前关注相关技术动态。`,
        summaryGeneratedAt: now - oneHour,
        summaryStatus: "success",
        model: "gpt-4",
        statistics: {
            topicCount: 312,
            mostActiveGroups: ["前端技术交流群", "React 学习群", "Node.js 开发群"],
            mostActiveHour: 14
        },
        topicIds: ["topic-001", "topic-002", "topic-003", "topic-006", "topic-007", "topic-011"],
        createdAt: now - oneHour,
        updatedAt: now - oneHour
    },
    {
        reportId: "report-008",
        type: "half-daily",
        timeStart: now - 2 * oneDay - 6 * oneHour,
        timeEnd: now - 2 * oneDay,
        isEmpty: false,
        summary: `大前天上午的讨论：

**1. CSS 现代布局**
讨论了 CSS Grid 和 Flexbox 的高级用法，分享了响应式设计的最佳实践。

**2. Web 安全**
讨论了 XSS、CSRF 等常见安全问题的防范措施。

讨论内容实用性强，适合日常开发参考。`,
        summaryGeneratedAt: now - 2 * oneDay,
        summaryStatus: "success",
        model: "gpt-3.5-turbo",
        statistics: {
            topicCount: 6,
            mostActiveGroups: ["CSS 技术群"],
            mostActiveHour: 11
        },
        topicIds: ["topic-014", "topic-015"],
        createdAt: now - 2 * oneDay,
        updatedAt: now - 2 * oneDay
    },
    {
        reportId: "report-009",
        type: "half-daily",
        timeStart: now - 3 * oneDay - 6 * oneHour,
        timeEnd: now - 3 * oneDay,
        isEmpty: false,
        summary: "上午讨论了移动端开发相关话题，包括 React Native 和 Flutter 的对比分析。",
        summaryGeneratedAt: now - 3 * oneDay,
        summaryStatus: "success",
        model: "gpt-3.5-turbo",
        statistics: {
            topicCount: 5,
            mostActiveGroups: ["移动开发群"],
            mostActiveHour: 10
        },
        topicIds: ["topic-016"],
        createdAt: now - 3 * oneDay,
        updatedAt: now - 3 * oneDay
    },
    {
        reportId: "report-010",
        type: "half-daily",
        timeStart: now - 4 * oneDay - 6 * oneHour,
        timeEnd: now - 4 * oneDay,
        isEmpty: false,
        summary: "讨论了测试驱动开发（TDD）的实践经验，分享了 Jest 和 Vitest 的使用技巧。",
        summaryGeneratedAt: now - 4 * oneDay,
        summaryStatus: "failed",
        model: "",
        statistics: {
            topicCount: 7,
            mostActiveGroups: ["测试技术群"],
            mostActiveHour: 9
        },
        topicIds: ["topic-017", "topic-018"],
        createdAt: now - 4 * oneDay,
        updatedAt: now - 4 * oneDay
    }
];

/**
 * 模拟延迟
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 模拟获取单个日报
 */
export const mockGetReportById = async (reportId: string): Promise<ApiResponse<Report>> => {
    await delay(300 + Math.random() * 200);

    const report = mockReports.find(r => r.reportId === reportId);

    if (report) {
        return {
            success: true,
            data: report,
            message: ""
        };
    }

    return {
        success: false,
        data: null as unknown as Report,
        message: "日报不存在"
    };
};

/**
 * 模拟获取日报列表（分页）
 */
export const mockGetReportsPaginated = async (page: number, pageSize: number, type?: ReportType): Promise<ApiResponse<ReportsPaginatedResponse>> => {
    await delay(400 + Math.random() * 300);

    // 按类型过滤
    let filteredReports = type ? mockReports.filter(r => r.type === type) : mockReports;

    // 按时间倒序排序
    filteredReports = [...filteredReports].sort((a, b) => b.timeEnd - a.timeEnd);

    // 分页
    const total = filteredReports.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const reports = filteredReports.slice(start, end);

    return {
        success: true,
        data: {
            reports,
            total,
            page,
            pageSize
        },
        message: ""
    };
};

/**
 * 模拟获取指定日期的日报
 */
export const mockGetReportsByDate = async (date: string | number): Promise<ApiResponse<Report[]>> => {
    await delay(300 + Math.random() * 200);

    const targetDate = new Date(typeof date === "string" ? parseInt(date) : date);
    const targetDateStr = targetDate.toDateString();

    // 查找当天的日报
    const reports = mockReports.filter(r => {
        const reportDate = new Date(r.timeEnd);

        return reportDate.toDateString() === targetDateStr;
    });

    // 按时间倒序排序
    reports.sort((a, b) => b.timeEnd - a.timeEnd);

    return {
        success: true,
        data: reports,
        message: ""
    };
};

/**
 * 模拟获取指定时间范围内的日报
 */
export const mockGetReportsByTimeRange = async (timeStart: number, timeEnd: number, type?: ReportType): Promise<ApiResponse<Report[]>> => {
    await delay(400 + Math.random() * 300);

    let reports = mockReports.filter(r => r.timeEnd >= timeStart && r.timeStart <= timeEnd);

    if (type) {
        reports = reports.filter(r => r.type === type);
    }

    // 按时间倒序排序
    reports.sort((a, b) => b.timeEnd - a.timeEnd);

    return {
        success: true,
        data: reports,
        message: ""
    };
};

/**
 * 模拟获取最近的日报
 */
export const mockGetRecentReports = async (type: ReportType, limit: number): Promise<ApiResponse<Report[]>> => {
    await delay(300 + Math.random() * 200);

    const reports = mockReports
        .filter(r => r.type === type)
        .sort((a, b) => b.timeEnd - a.timeEnd)
        .slice(0, limit);

    return {
        success: true,
        data: reports,
        message: ""
    };
};

/**
 * 模拟触发生成日报
 */
export const mockTriggerReportGenerate = async (type: ReportType, timeStart?: number, timeEnd?: number): Promise<ApiResponse<TriggerReportGenerateResponse>> => {
    await delay(500 + Math.random() * 500);

    // 模拟时间范围
    const now = Date.now();
    const actualTimeEnd = timeEnd ?? now;
    let actualTimeStart: number;

    if (timeStart !== undefined) {
        actualTimeStart = timeStart;
    } else {
        switch (type) {
            case "half-daily":
                actualTimeStart = now - 12 * 60 * 60 * 1000;
                break;
            case "weekly":
                actualTimeStart = now - 7 * 24 * 60 * 60 * 1000;
                break;
            case "monthly":
                actualTimeStart = now - 30 * 24 * 60 * 60 * 1000;
                break;
        }
    }

    // 获取类型显示名称
    const typeNames: Record<ReportType, string> = {
        "half-daily": "半日报",
        weekly: "周报",
        monthly: "月报"
    };

    console.log(`[Mock] 触发生成 ${typeNames[type]}: ${new Date(actualTimeStart).toLocaleString()} - ${new Date(actualTimeEnd).toLocaleString()}`);

    return {
        success: true,
        data: {
            success: true,
            message: `${typeNames[type]} 生成任务已提交，请稍后刷新查看结果`
        },
        message: ""
    };
};

// ==================== 日报已读状态模拟 ====================

// 模拟的已读状态存储
const mockReadReports: Record<string, boolean> = {};

/**
 * 模拟标记日报为已读
 */
export const mockMarkReportAsRead = async (reportId: string): Promise<ApiResponse<{ message: string }>> => {
    await delay(200 + Math.random() * 100);

    mockReadReports[reportId] = true;

    return {
        success: true,
        data: { message: "日报已标记为已读" },
        message: ""
    };
};

/**
 * 模拟清除日报的已读状态
 */
export const mockUnmarkReportAsRead = async (reportId: string): Promise<ApiResponse<{ message: string }>> => {
    await delay(200 + Math.random() * 100);

    delete mockReadReports[reportId];

    return {
        success: true,
        data: { message: "日报已读状态已清除" },
        message: ""
    };
};

/**
 * 模拟批量检查日报已读状态
 */
export const mockGetReportsReadStatus = async (reportIds: string[]): Promise<ApiResponse<{ readStatus: Record<string, boolean> }>> => {
    await delay(200 + Math.random() * 100);

    const readStatus: Record<string, boolean> = {};

    for (const reportId of reportIds) {
        readStatus[reportId] = mockReadReports[reportId] === true;
    }

    return {
        success: true,
        data: { readStatus },
        message: ""
    };
};

// ==================== 日报邮件发送模拟 ====================

/**
 * 模拟发送日报邮件
 */
export const mockSendReportEmail = async (reportId: string): Promise<ApiResponse<{ success: boolean; message: string }>> => {
    await delay(1000 + Math.random() * 1000);

    // 检查日报是否存在
    const report = mockReports.find(r => r.reportId === reportId);

    if (!report) {
        return {
            success: false,
            data: { success: false, message: "未找到对应的日报" },
            message: ""
        };
    }

    console.log(`[Mock] 发送日报邮件: ${reportId}`);

    return {
        success: true,
        data: { success: true, message: "日报邮件发送成功" },
        message: ""
    };
};
