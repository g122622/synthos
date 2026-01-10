# WebUI Backend

WebUI 后端接口服务，提供HTTP API接口供前端调用。

## 功能特性

- **RESTful API**：提供标准化的HTTP接口
- **参数校验**：使用 Zod 进行请求参数校验
- **CORS支持**：支持跨域请求
- **配置面板**：提供配置管理接口

## 技术栈

- **Express**：Web应用框架
- **Zod**：数据验证库
- **CORS**：跨域资源共享

## 项目结构

```
src/
├── index.ts           # 主入口
├── configPanelIndex.ts # 配置面板入口
└── 其他业务代码...
```

## 开发命令

```bash
# 构建
pnpm run build

# 启动主服务
pnpm run dev

# 启动配置面板服务
pnpm run dev:config-panel
```

## API规范

- 所有请求参数必须通过 Zod schema 进行校验
- 错误处理遵循统一规范
- 返回格式保持一致

## 依赖说明

- 本项目依赖 `common` 目录下的公共代码
- 前后端通过 HTTP 接口通信
- 参数校验使用 `src/schemas` 目录下的 schema 定义
