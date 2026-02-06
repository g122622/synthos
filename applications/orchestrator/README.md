# Orchestrator：可视化工作流引擎

**Orchestrator** 是 Synthos 项目的工作流调度与编排核心，基于事件驱动的 **DAG（有向无环图）执行引擎**，提供灵活的工作流定义、远程管理、实时状态推送以及断点续跑等高级能力。

## 核心功能特性

### 🚀 **工作流引擎（P0 已完成）**

- **DAG 执行引擎**：`WorkflowExecutor` - 基于拓扑排序的事件驱动引擎，支持任意复杂的 DAG 结构
- **执行持久化**：`ExecutionPersistence` - SQLite 持久化工作流执行状态，支持断点续跑和历史回溯
- **条件分支**：`ConditionEvaluator` - 支持上游节点状态判断、键值匹配、自定义表达式
- **节点适配器**：`NodeExecutorAdapter` - 解耦引擎与任务执行，生产环境使用 `AgendaNodeExecutorAdapter`（调用 Agenda 任务队列）
- **重试策略**：支持节点级别的重试次数、超时时间、失败跳过等配置

### 🔌 **tRPC 远程管理（P1 已完成）**

- **工作流管理**：
  - `listWorkflows` - 列出所有已定义的工作流
  - `getWorkflow` - 获取单个工作流的详细定义
  - `triggerWorkflow` - 手动触发工作流执行
- **执行管理**：
  - `cancelExecution` - 取消正在执行的工作流
  - `retryExecution` - 断点续跑（从失败节点重新执行）
  - `listExecutions` - 查询工作流执行历史
  - `getExecution` - 获取单次执行的详细状态（包含每个节点的执行结果）
- **实时推送**：
  - `onExecutionUpdate` - WebSocket 订阅，实时推送执行状态变化（节点开始/完成/失败/输出）

### 📅 **定时触发**

- 通过 Agenda 定时任务实现工作流的 cron 触发
- 默认每小时触发一次标准数据处理流程（`default-pipeline`）
- 支持半日报定时生成（`HalfDailyReport_morning` / `HalfDailyReport_afternoon`）

## 项目结构

```
applications/orchestrator/src/
├── core/                      # P0：工作流引擎核心
│   ├── WorkflowExecutor.ts    # 主执行引擎（事件驱动）
│   ├── DagParser.ts           # 拓扑排序与循环检测
│   ├── ExecutionContext.ts    # 执行上下文（存储节点输出）
│   ├── ExecutionPersistence.ts# SQLite 持久化层
│   ├── ConditionEvaluator.ts  # 条件分支逻辑
│   └── NodeExecutionStrategy.ts # 节点执行策略（重试/超时/跳过）
├── adapters/                  # 节点执行适配器
│   ├── NodeExecutorAdapter.ts # 适配器接口
│   └── AgendaNodeExecutorAdapter.ts # Agenda 任务队列适配器
├── rpc/                       # P1：tRPC 远程管理
│   ├── server.ts              # tRPC HTTP + WebSocket 服务器
│   └── impl.ts                # RPC 接口实现（OrchestratorRPCImpl）
└── index.ts                   # 主入口：初始化引擎、注册工作流、启动 RPC 服务器
```

## 工作流定义格式

工作流使用标准 JSON 格式定义，符合 `WorkflowDefinition` 接口（见 `common/contracts/workflow/index.ts`）：

```typescript
{
  "id": "default-pipeline",
  "name": "标准数据处理流程",
  "description": "ProvideData → Preprocess → AISummarize → GenerateEmbedding → InterestScore",
  "nodes": [
    {
      "id": "provide-data",
      "type": "task",
      "position": { "x": 100, "y": 100 },
      "data": {
        "label": "提供数据",
        "taskType": "ProvideData",
        "params": {},
        "retryCount": 3,
        "timeoutMs": 600000
      }
    },
    // ... 更多节点
  ],
  "edges": [
    { "id": "e1", "source": "provide-data", "target": "preprocess" }
  ]
}
```

### 节点类型

| 类型 | 描述 | 使用场景 |
|------|------|---------|
| `start` | 开始节点 | DAG 入口（非必需） |
| `end` | 结束节点 | DAG 出口（非必需） |
| `task` | Agenda 任务节点 | 调用 Agenda 任务队列（如 `ProvideData`、`Preprocess`） |
| `condition` | 条件分支节点 | 根据上游节点结果决定分支路径 |
| `parallel` | 并行节点 | 多个下游节点并发执行 |
| `script` | 脚本节点 | 执行自定义 JavaScript 代码 |
| `http` | HTTP 请求节点 | 调用外部 API |

### 条件表达式

支持4种条件类型：

- `previousNodeSuccess` - 上游节点执行成功
- `previousNodeFailed` - 上游节点执行失败
- `keyValueMatch` - 键值匹配（如 `previousNode.output.status === "ready"`）
- `customExpression` - 自定义 JavaScript 表达式

## 配置项

在 `synthos_config.json` 中配置：

```json
{
  "orchestrator": {
    "pipelineIntervalInMinutes": 60,    // 默认流程触发间隔（分钟）
    "dataSeekTimeWindowInHours": 100,   // 数据回溯时间窗口（小时）
    "rpcPort": 8081,                    // tRPC 服务端口（P1 新增）
    "workflows": [                       // 工作流定义列表（P1 新增）
      // 在此定义自定义工作流，或留空使用默认生成的流程
    ]
  }
}
```

## 开发命令

```bash
# 构建
pnpm run build

# 开发运行（支持 HMR）
pnpm run dev

# 类型检查
npx tsc --noEmit
```

## RPC 接口文档

详见：[docs/接口文档/API文档.md - Orchestrator RPC 接口](../../docs/接口文档/API文档.md)

### 示例：手动触发工作流

```bash
curl -X POST http://localhost:3002/api/triggerWorkflow \
  -H "Content-Type: application/json" \
  -d '{"workflowId": "default-pipeline"}'
```

### 示例：订阅执行状态（WebSocket）

```javascript
import { createWSClient, createTRPCProxyClient, wsLink } from '@trpc/client';

const wsClient = createWSClient({ url: 'ws://localhost:8081' });
const client = createTRPCProxyClient({ links: [wsLink({ client: wsClient })] });

client.onExecutionUpdate.subscribe({ executionId: "exec_xxx" }, {
  onData(event) {
    console.log("节点状态更新:", event);
  }
});
```

## 设计原则

1. **依赖倒置**：引擎不依赖具体任务实现，通过 `NodeExecutorAdapter` 解耦
2. **事件驱动**：`WorkflowExecutor` 继承自 `EventEmitter`，支持 `nodeStarted`、`nodeCompleted`、`workflowCompleted` 等事件
3. **状态持久化**：所有执行状态保存到 SQLite，支持随时恢复
4. **类型安全**：工作流定义使用 Zod Schema 校验，运行时类型检查
5. **并发控制**：tRPC 实现中维护 `Map<executionId, WorkflowExecutor>`，防止重复执行

## 迭代历程

- **P0（已完成）**：工作流引擎核心 - DAG 执行、持久化、适配器模式
- **P1（已完成）**：tRPC 通信层 - 远程管理、实时推送、断点续跑
- **P2（规划中）**：前端可视化编排 - React Flow 画布、拖拽节点、实时预览

## 依赖说明

- **引擎依赖**：`common/contracts/workflow` - 工作流类型定义
- **持久化依赖**：`common/services/database` - SQLite 数据库服务
- **任务队列依赖**：`common/scheduler/agenda` - Agenda 任务调度
- **RPC 通信**：`common/rpc/orchestrator` - tRPC 路由与 Schema 定义

## 故障排查

### Q: 工作流执行失败，如何定位问题？

A: 
1. 查看 `getExecution` 返回的 `snapshot.nodeStates`，找到失败节点
2. 检查失败节点的 `error` 字段获取错误信息
3. 查看对应 Agenda 任务的日志（如果是 `task` 类型节点）

### Q: 如何修改默认的数据处理流程？

A:
1. 在配置文件的 `orchestrator.workflows` 中定义自定义流程，ID 设为 `"default-pipeline"`
2. 或者修改 `src/index.ts` 中的 `generateDefaultWorkflow()` 函数

### Q: 断点续跑失败怎么办？

A:
1. 确认 `ExecutionPersistence` 初始化成功（检查 `data/orchestrator_executions.db` 是否存在）
2. 确认 `executionId` 正确且存在
3. 检查失败节点的 `skipOnFailure` 配置

---

**完整设计文档**：[docs/迭代历程/可视化编排.md](../../docs/迭代历程/可视化编排.md)
