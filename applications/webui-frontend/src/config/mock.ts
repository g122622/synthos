/**
 * Mock 配置
 * 控制是否启用 mock 数据
 */

// 通过环境变量或检测后端是否可用来决定是否使用 mock
// 设置为 true 时，将使用 mock 数据而非真实 API
export const MOCK_ENABLED = import.meta.env.VITE_MOCK_ENABLED === "true";

// 也可以针对特定模块单独控制
export const mockConfig = {
    // RAG 模块 mock 开关
    rag: import.meta.env.VITE_MOCK_RAG === "true" || MOCK_ENABLED,
    // Report 模块 mock 开关
    report: import.meta.env.VITE_MOCK_REPORT === "true" || MOCK_ENABLED,
    // Groups 模块 mock 开关
    groups: import.meta.env.VITE_MOCK_GROUPS === "true" || MOCK_ENABLED,
    // Latest Topics 模块 mock 开关
    latestTopics: import.meta.env.VITE_MOCK_LATEST_TOPICS === "true" || MOCK_ENABLED,
    // Agent 模块 mock 开关
    agent: import.meta.env.VITE_MOCK_AGENT === "true" || MOCK_ENABLED,
    // Config Panel 模块 mock 开关
    configPanel: import.meta.env.VITE_MOCK_CONFIG_PANEL === "true" || MOCK_ENABLED,
    // System Monitor 模块 mock 开关
    systemMonitor: import.meta.env.VITE_MOCK_SYSTEM_MONITOR === "true" || MOCK_ENABLED
};
