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
    report: import.meta.env.VITE_MOCK_REPORT === "true" || MOCK_ENABLED
};
