# Orchestrator

Pipeline 调度器，按顺序串联执行各个数据处理任务。

## 功能特性

- **任务编排**：按预定顺序调度和执行数据处理任务
- **报告生成调度**：定时触发报告生成流程

## 项目结构

```
src/
├── schedulers/         # 调度器实现
│   └── reportScheduler.ts  # 报告生成调度器
└── index.ts           # 主入口
```

## 工作流程

Orchestrator 负责协调各个数据处理任务的执行顺序：

1. 数据预处理（preprocessing）
2. 数据提供（data-provider）
3. AI模型处理（ai-model）
4. 报告生成

## 开发命令

```bash
# 构建
pnpm run build

# 开发运行
pnpm run dev
```

## 设计原则

- 各任务通过定义良好的接口进行通信
- 任务之间解耦，每个任务独立运行
- 调度器只负责编排，不包含业务逻辑

## 依赖说明

- 本项目依赖 `common` 目录下的公共代码
- 通过RPC或消息队列与其他服务通信
