# Preprocessing Service

数据预处理服务，对原始聊天消息进行清洗和分割。

## 功能特性

- **消息格式化**：将原始消息转换为标准格式
- **消息分割**：将连续消息分割成适合处理的数据块
  - **累积分割器**（AccumulativeSplitter）：按消息数量累积分割
  - **超时分割器**（TimeoutSplitter）：按时间间隔分割

## 项目结构

```
src/
├── di/               # 依赖注入容器
├── splitters/        # 消息分割器实现
│   ├── contracts/    # 分割器接口定义
│   ├── AccumulativeSplitter.ts
│   └── TimeoutSplitter.ts
├── tasks/            # 预处理任务
├── formatMsg.ts      # 消息格式化工具
└── index.ts          # 主入口
```

## 分割器说明

### AccumulativeSplitter（累积分割器）

按照预设的消息数量进行分割，例如每100条消息为一个数据块。

### TimeoutSplitter（超时分割器）

按照时间间隔进行分割，当消息间隔超过设定阈值时进行分割。

## 开发命令

```bash
# 构建
pnpm run build

# 开发运行
pnpm run dev
```

## 依赖说明

- 本项目依赖 `common` 目录下的公共代码
- 需要通过 tsyringe 进行依赖注入
- 输出标准化的数据格式供下游服务使用
