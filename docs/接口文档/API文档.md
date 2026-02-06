# WebUI Backend API 文档（已按源码重写）

## 1. 服务信息

- 默认本地地址：`http://localhost:3002`
- 端口来源：
    - 正常模式：取配置 `webUI_Backend.port`
    - 配置面板模式：取环境变量 `CONFIG_PANEL_PORT`（默认 3002）

## 2. 通用约定

### 2.1 Content-Type

- 除 GET 查询参数外，所有 POST 请求都使用 JSON：`Content-Type: application/json`

### 2.2 时间戳

- 全部使用 **UNIX 毫秒时间戳**。
- 对于 POST JSON body：请直接传 number。
- `GET /api/chat-messages-by-group-id` 的 `timeStart/timeEnd` 来自 query string，只能是字符串；请传“字符串形式的数字”，后端会 `parseInt`。

### 2.3 通用响应格式（大多数接口）

成功：

```json
{ "success": true, "data": {} }
```

部分“成功但无数据”的接口使用 `message`：

```json
{ "success": true, "message": "..." }
```

失败（全局错误处理中间件）：

```json
{ "success": false, "message": "错误描述" }
```

### 2.4 例外：系统监控接口不包裹 success

- `GET /api/system/monitor/latest`：直接返回 `SystemStats` 或 `{}`
- `GET /api/system/monitor/history`：直接返回 `SystemStats[]`

### 2.5 例外：配置接口的部分错误字段为 error

`ConfigController` 中部分分支直接返回：

```json
{ "success": false, "error": "..." }
```

或：

```json
{ "success": false, "error": "配置验证失败", "details": ["..."] }
```

前端应同时兼容 `message` 与 `error`。

---

## 3. 健康检查

### GET /health

响应：

```json
{
  "success": true,
  "message": "WebUI后端服务运行正常",
  "timestamp": "2026-01-19T00:00:00.000Z"
}
```

---

## 4. 群组

### GET /api/group-details

说明：返回当前配置中的 `groupConfigs`（结构由配置决定）。

响应：

```json
{ "success": true, "data": { "<groupId>": { "IM": "QQ" } } }
```

---

## 5. 聊天消息

### GET /api/chat-messages-by-group-id

Query：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| groupId | string | 是 | 群组ID |
| timeStart | string | 是 | 起始时间戳（毫秒，字符串） |
| timeEnd | string | 是 | 结束时间戳（毫秒，字符串） |

响应 `data`：`ProcessedChatMessageWithRawMessage[]`

```ts
type ProcessedChatMessageWithRawMessage = {
  msgId: string;
  messageContent: string;
  groupId: string;
  timestamp: number;
  senderId: string;
  senderGroupNickname: string;
  senderNickname: string;
  quotedMsgId?: string;
  quotedMsgContent?: string;
  sessionId: string;
  preProcessedContent?: string;
}[];
```

### POST /api/session-ids-by-group-ids-and-time-range

Body：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| groupIds | string[] | 是 | 群组ID数组 |
| timeStart | number \| string | 是 | 起始时间戳（毫秒） |
| timeEnd | number \| string | 是 | 结束时间戳（毫秒） |

响应 `data`：

```ts
{ groupId: string; sessionIds: string[] }[]
```

### POST /api/session-time-durations

Body：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| sessionIds | string[] | 是 | 会话ID数组 |

响应 `data`：

```ts
{ sessionId: string; timeStart?: number; timeEnd?: number }[]
```

### POST /api/message-hourly-stats

Body：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| groupIds | string[] | 是 | 群组ID数组 |

响应 `data`：

---

### POST /api/chat-messages-fts-search

说明：聊天消息“全文检索（FTS）”查询接口。该接口查询的是独立的 FTS 数据库文件（由 db-cli 手动构建索引）。

Body：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| query | string | 是 | 搜索文本（纯文本，不暴露 FTS 语法） |
| groupIds | string[] | 否 | 群组过滤；不传则全库 |
| timeStart | number | 否 | 起始时间戳（毫秒） |
| timeEnd | number | 否 | 结束时间戳（毫秒） |
| page | number | 是 | 从 1 开始 |
| pageSize | number | 是 | 1~100 |

响应 `data`：

```ts
{
  groups: {
    groupId: string;
    count: number; // 该群组命中总数
    hits: {
      msgId: string;
      timestamp: number;
      snippet: string; // 片段（高亮由前端完成）
    }[];
  }[];
  total: number; // 全库命中总数（groupIds/time 过滤后）
  page: number;
  pageSize: number;
}
```

备注：群组之间按命中数降序，群内默认按相关性（FTS bm25）优先、再按时间。

### POST /api/chat-messages-fts-context

说明：根据命中消息获取前后 N 条上下文（用于点击命中后展开）。

Body：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| groupId | string | 是 | 群组ID |
| msgId | string | 是 | 目标消息ID |
| before | number | 否 | 取前 N 条，默认 20，0~200 |
| after | number | 否 | 取后 N 条，默认 20，0~200 |

响应 `data`：`ProcessedChatMessageWithRawMessage[]`

```ts
{
  data: Record<string, { current: number[]; previous: number[] }>;
  timestamps: { current: number[]; previous: number[] };
  totalCounts: { current: number; previous: number };
}
```

---

## 6. AI 摘要

### GET /api/ai-digest-result-by-topic-id

Query：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| topicId | string | 是 | 主题ID |

响应 `data`：

```ts
{
  topicId: string;
  sessionId: string;
  topic: string;
  contributors: string;
  detail: string;
  modelName: string;
  updateTime: number;
}
```

### POST /api/ai-digest-results-by-session-ids

Body：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| sessionIds | string[] | 是 | 会话ID数组 |

响应 `data`：

```ts
{ sessionId: string; result: AIDigestResult[] }[]
```

### GET /api/is-session-summarized

Query：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| sessionId | string | 是 | 会话ID |

响应：

```json
{ "success": true, "data": { "isSummarized": true } }
```

---

## 7. 杂项

### GET /api/qq-avatar

Query：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| qqNumber | string | 是 | QQ 号码 |

响应：

```json
{ "success": true, "data": { "avatarBase64": "..." } }
```

---

## 8. 兴趣度评分

### POST /api/interest-score-results

Body：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| topicIds | string[] | 是 | 主题ID数组 |

响应 `data`：

```ts
{ topicId: string; score: unknown }[]
```

---

## 9. 话题状态（收藏 / 已读）

### POST /api/topic/favorite/mark

Body：`{ "topicId": string }`

响应：`{ "success": true, "message": "话题已标记为收藏" }`

### POST /api/topic/favorite/remove

Body：`{ "topicId": string }`

响应：`{ "success": true, "message": "话题已从收藏中移除" }`

### POST /api/topic/favorite/status

Body：`{ "topicIds": string[] }`

响应：

```json
{ "success": true, "data": { "favoriteStatus": { "<topicId>": true } } }
```

### POST /api/topic/read/mark

Body：`{ "topicId": string }`

响应：`{ "success": true, "message": "话题已标记为已读" }`

### POST /api/topic/read/unmark

Body：`{ "topicId": string }`

响应：`{ "success": true, "message": "话题已读状态已清除" }`

### POST /api/topic/read/status

Body：`{ "topicIds": string[] }`

响应：

```json
{ "success": true, "data": { "readStatus": { "<topicId>": false } } }
```

---

## 10. 搜索与问答

### POST /api/search

Body：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| query | string | 是 | 搜索文本 |
| limit | number | 否 | 默认 10 |

响应 `data`：

```ts
{
  topicId: string;
  topic: string;
  detail: string;
  distance: number;
  contributors: string;
}[]
```

### POST /api/ask

Body：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| question | string | 是 | 问题文本 |
| topK | number | 否 | 默认 5 |
| enableQueryRewriter | boolean | 否 | 默认 true |

响应 `data`：

```ts
{
  answer: string;
  references: { topicId: string; topic: string; relevance: number }[];
  sessionId?: string;
}
```

---

## 11. RAG 问答历史（WebUI-Backend 持久化）

说明：会话创建由 WebUI-Backend 在 tRPC `askStream` 结束后自动落库；前端通过以下接口查询/管理历史。

### POST /api/rag/session/list

Body：`{ "limit": number; "offset": number }`

响应 `data`：

```ts
{
  sessions: { id: string; title: string; createdAt: number; updatedAt: number; isFailed?: boolean }[];
  total: number;
  hasMore: boolean;
}
```

### POST /api/rag/session/detail

Body：`{ "sessionId": string }`

响应：

- 存在：`{ success: true, data: SessionDetail }`
- 不存在：`{ success: false, message: "会话不存在" }`（HTTP 仍为 200）

其中 `SessionDetail` 额外包含：

```ts
{
  isFailed?: boolean;
  failReason?: string;
}
```

### POST /api/rag/session/delete

Body：`{ "sessionId": string }`

响应：`{ "success": true, "message": "会话已删除" }`

### POST /api/rag/session/update-title

Body：`{ "sessionId": string; "title": string }`

响应：`{ "success": true, "message": "标题已更新" }`

### POST /api/rag/session/clear-all

响应：`{ "success": true, "message": "所有会话已清空" }`

### POST /api/rag/session/toggle-pin

切换会话的置顶状态。

Body：`{ "sessionId": string; "pinned": boolean }`

响应：`{ "success": true, "message": "会话已置顶" | "会话已取消置顶" }`

---

## 12. 日报

### GET /api/report/:reportId

Path：`reportId: string`

响应 `data`：

```ts
type Report = {
  reportId: string;
  type: "half-daily" | "weekly" | "monthly";
  timeStart: number;
  timeEnd: number;
  isEmpty: boolean;
  summary: string;
  summaryGeneratedAt: number;
  summaryStatus: "success" | "failed" | "pending";
  model: string;
  statistics: { topicCount: number; mostActiveGroups: string[]; mostActiveHour: number };
  topicIds: string[];
  createdAt: number;
  updatedAt: number;
};
```

### POST /api/reports

Body：

```ts
{ page: number; pageSize: number; type?: "half-daily" | "weekly" | "monthly" }
```

响应 `data`：

```ts
{ reports: Report[]; total: number; page: number; pageSize: number }
```

### POST /api/reports/by-date

Body：`{ date: string | number }`

说明：后端 `new Date(date)`，建议传 ISO 字符串或毫秒时间戳。

响应 `data`：`Report[]`（当前实现用于获取某日的半日报）。

### POST /api/reports/by-time-range

Body：

```ts
{ timeStart: number; timeEnd: number; type?: "half-daily" | "weekly" | "monthly" }
```

响应 `data`：`Report[]`

### POST /api/reports/recent

Body：`{ type: "half-daily" | "weekly" | "monthly"; limit: number }`

响应 `data`：`Report[]`

### POST /api/reports/generate

Body：`{ type: "half-daily" | "weekly" | "monthly"; timeStart?: number; timeEnd?: number }`

响应 `data`：

```ts
{ success?: boolean; message?: string; reportId?: string }
```

### POST /api/report/read/mark

Body：`{ reportId: string }`

响应：`{ "success": true, "message": "日报已标记为已读" }`

### POST /api/report/read/unmark

Body：`{ reportId: string }`

响应：`{ "success": true, "message": "日报已读状态已清除" }`

### POST /api/report/read/status

Body：`{ reportIds: string[] }`

响应：

```json
{ "success": true, "data": { "readStatus": { "<reportId>": true } } }
```

### POST /api/report/send-email

Body：`{ reportId: string }`

响应：

```ts
{ success: boolean; data: { success: boolean; message: string } }
```

---

## 13. 系统监控（无 success 包裹）

### GET /api/system/monitor/latest

响应：

```ts
type SystemStats = {
  timestamp: number;
  storage: {
    chatRecordDB: { count: number; size: number };
    imMessageFtsDB: { count: number; size: number };
    aiDialogueDB: { count: number; size: number };
    vectorDB: { count: number; size: number };
    kvStoreBackend: { count: number; size: number };
    kvStorePersistent: { count: number; size: number };
    logs: { count: number; size: number };
    totalSize: number;
  };
  modules: Record<string, { cpu: number; memory: number }>;
};
```

### GET /api/system/monitor/history

响应：`SystemStats[]`

---

## 14. Agent

### POST /api/agent/ask

说明：该接口为**非流式**（一次性返回）。如果需要流式输出（token/工具调用过程），请使用 `POST /api/agent/ask/stream`（SSE）。

Body：

```ts
{
  question: string;
  conversationId?: string;
  sessionId?: string;
  enabledTools?: ("rag_search" | "sql_query" | "web_search")[];
  maxToolRounds?: number;
  temperature?: number;
  maxTokens?: number;
}
```

响应 `data`：

```ts
{
  conversationId: string;
  messageId: string;
  content: string;
  toolsUsed: string[];
  toolRounds: number;
  totalUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

### POST /api/agent/ask/stream（SSE）

说明：Agent 流式问答接口，使用 **SSE（`text/event-stream`）** 按稳定业务事件协议推送。

- 请求方式：`POST`
- 响应头：`Content-Type: text/event-stream`
- 连接关闭：服务端在收到 `done` 或 `error` 事件后会结束连接
- 并发限制：同一个 `conversationId` **不允许并行跑**（单实例内存锁）；若并行请求会返回 HTTP `409`

Body：与 `/api/agent/ask` 相同：

```ts
{
  question: string;
  conversationId?: string;
  sessionId?: string;
  enabledTools?: ("rag_search" | "sql_query" | "web_search")[];
  maxToolRounds?: number;
  temperature?: number;
  maxTokens?: number;
}
```

SSE 事件格式：每个事件由 `event:` + `data:`（JSON）组成，例如：

```text
event: token
data: {"type":"token","ts":1737777777000,"conversationId":"<id>","content":"你好"}

```

事件 `data`（稳定业务事件协议）：

```ts
type AgentEvent =
  | {
      type: "token";
      ts: number; // UNIX ms
      conversationId: string;
      content: string;
    }
  | {
      type: "tool_call";
      ts: number;
      conversationId: string;
      toolCallId: string;
      toolName: string;
      toolArgs: unknown;
    }
  | {
      type: "tool_result";
      ts: number;
      conversationId: string;
      toolCallId: string;
      toolName: string;
      result: unknown;
    }
  | {
      type: "done";
      ts: number;
      conversationId: string;
      messageId?: string;
      content?: string;
      toolsUsed?: string[];
      toolRounds?: number;
      totalUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
    }
  | {
      type: "error";
      ts: number;
      conversationId: string;
      error: string;
    };
```

错误响应：

- 并发冲突：HTTP `409`，JSON：`{ success: false, error: string }`
- 其他错误：通常通过 SSE `error` 事件返回（随后连接关闭）

### POST /api/agent/state/history

说明：获取指定 `conversationId`（对应 LangGraph `thread_id`）的 checkpoint 历史，用于 time-travel / 调试。

Body：

```ts
{
  conversationId: string;
  limit?: number; // 默认 20，最大 100
  beforeCheckpointId?: string;
}
```

响应 `data`：

```ts
{
  items: Array<{
    checkpointId: string;
    createdAt: number; // UNIX ms
    next: string[];
    metadata?: unknown;
  }>;
  nextCursor?: string;
}
```

### POST /api/agent/state/fork

说明：从某个 checkpoint fork 出一个新的 thread（新的 `conversationId`），用于“从历史分叉继续对话”。

Body：

```ts
{
  conversationId: string;
  checkpointId: string;
  newConversationId?: string;
}
```

响应 `data`：

```ts
{ conversationId: string }
```

```

### POST /api/agent/conversations

Body：

```ts
{ sessionId?: string; beforeUpdatedAt?: number; limit?: number }
```

响应 `data`：

```ts
{ id: string; sessionId?: string; title: string; createdAt: number; updatedAt: number }[]
```

### POST /api/agent/conversations/:id/messages

Path：`id = conversationId`

Body：

```ts
{ beforeTimestamp?: number; limit?: number }
```

响应 `data`：

```ts
{
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  toolsUsed?: string[];
  toolRounds?: number;
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}[]
```

---

## 15. 配置（配置面板/正常模式均可用）

### GET /api/config/schema

响应：`{ success: true, data: JsonSchema }`

### GET /api/config/current

响应：`{ success: true, data: GlobalConfig }`

### GET /api/config/base

成功：`{ success: true, data: GlobalConfig }`

失败（文件不存在）：HTTP 404

```json
{ "success": false, "error": "基础配置文件不存在" }
```

### POST /api/config/base

Body：`GlobalConfig`

成功：`{ success: true, message: "基础配置保存成功" }`

失败（HTTP 400）：

```json
{ "success": false, "error": "..." }
```

### GET /api/config/override

响应：`{ success: true, data: PartialGlobalConfig | {} }`

### POST /api/config/override

Body：`PartialGlobalConfig`

- 验证失败（HTTP 400）：`{ success: false, error: "配置验证失败", details: string[] }`
- 保存成功：`{ success: true, message: "配置保存成功，请手动重启服务以使配置生效" }`

### POST /api/config/validate

Body：

```ts
{ config: unknown; partial?: boolean }
```

响应：

```ts
{
  success: true,
  data: { valid: true } | { valid: false; errors: string[] }
}
```

---

## 21. Orchestrator RPC 接口

**说明**：webui-backend 作为 tRPC 客户端，转发 orchestrator 的工作流管理 RPC 调用。所有接口均通过 HTTP POST 调用 `/api/<methodName>`。

### 21.1 listWorkflows - 列出所有工作流

#### 请求

- Method: `POST`
- URL: `/api/listWorkflows`
- Body: `{}`（无参数）

#### 响应

```json
{
  "success": true,
  "data": [
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
        }
      ],
      "edges": [
        { "id": "e1", "source": "provide-data", "target": "preprocess" }
      ]
    }
  ]
}
```

### 21.2 getWorkflow - 获取单个工作流详情

#### 请求

- Method: `POST`
- URL: `/api/getWorkflow`
- Body:

```json
{
  "workflowId": "default-pipeline"
}
```

#### 响应

```json
{
  "success": true,
  "data": {
    "id": "default-pipeline",
    "name": "标准数据处理流程",
    "description": "...",
    "nodes": [...],
    "edges": [...]
  }
}
```

#### 错误

```json
{
  "success": false,
  "message": "工作流 xxx 不存在"
}
```

### 21.3 triggerWorkflow - 手动触发工作流执行

#### 请求

- Method: `POST`
- URL: `/api/triggerWorkflow`
- Body:

```json
{
  "workflowId": "default-pipeline"
}
```

#### 响应

```json
{
  "success": true,
  "data": {
    "executionId": "exec_1706123456789_abc123",
    "message": "工作流执行已启动"
  }
}
```

#### 错误

```json
{
  "success": false,
  "message": "工作流 xxx 不存在"
}
```

### 21.4 cancelExecution - 取消正在执行的工作流

#### 请求

- Method: `POST`
- URL: `/api/cancelExecution`
- Body:

```json
{
  "executionId": "exec_1706123456789_abc123"
}
```

#### 响应

```json
{
  "success": true,
  "data": {
    "message": "工作流执行已取消"
  }
}
```

#### 错误

```json
{
  "success": false,
  "message": "执行 xxx 不存在或无法取消"
}
```

### 21.5 retryExecution - 断点续跑（从失败节点重新执行）

#### 请求

- Method: `POST`
- URL: `/api/retryExecution`
- Body:

```json
{
  "executionId": "exec_1706123456789_abc123"
}
```

#### 响应

```json
{
  "success": true,
  "data": {
    "newExecutionId": "exec_1706123999999_xyz789",
    "message": "断点续跑已启动"
  }
}
```

#### 错误

```json
{
  "success": false,
  "message": "执行 xxx 不存在"
}
```

### 21.6 listExecutions - 查询工作流执行历史

#### 请求

- Method: `POST`
- URL: `/api/listExecutions`
- Body:

```json
{
  "workflowId": "default-pipeline",
  "limit": 50
}
```

#### 响应

```json
{
  "success": true,
  "data": [
    {
      "executionId": "exec_1706123456789_abc123",
      "workflowId": "default-pipeline",
      "status": "success",
      "startedAt": 1706123456789,
      "completedAt": 1706123999999,
      "progress": {
        "total": 6,
        "completed": 6,
        "failed": 0,
        "running": 0
      }
    }
  ]
}
```

### 21.7 getExecution - 获取单次执行详情

#### 请求

- Method: `POST`
- URL: `/api/getExecution`
- Body:

```json
{
  "executionId": "exec_1706123456789_abc123"
}
```

#### 响应

```json
{
  "success": true,
  "data": {
    "executionId": "exec_1706123456789_abc123",
    "workflowId": "default-pipeline",
    "status": "success",
    "startedAt": 1706123456789,
    "completedAt": 1706123999999,
    "snapshot": {
      "nodeStates": [
        {
          "nodeId": "provide-data",
          "status": "success",
          "result": {
            "success": true,
            "output": { "recordCount": 100 }
          }
        },
        {
          "nodeId": "preprocess",
          "status": "success",
          "result": {
            "success": true,
            "output": { "sessionCount": 10 }
          }
        }
      ],
      "executionContext": {
        "provide-data": { "success": true, "output": { "recordCount": 100 } }
      }
    }
  }
}
```

#### 错误

```json
{
  "success": false,
  "message": "执行 xxx 不存在"
}
```

### 21.8 onExecutionUpdate - 订阅执行状态更新（WebSocket）

**说明**：此接口使用 tRPC 订阅机制，需通过 WebSocket 连接。前端应使用 `@trpc/client` 的 `wsLink` 创建 WebSocket 客户端。

#### 连接

- WebSocket URL: `ws://localhost:3002`（通过 webui-backend 转发）
- Protocol: tRPC WebSocket Subscription

#### 订阅请求

```typescript
import { createWSClient, createTRPCProxyClient, wsLink } from '@trpc/client';

const wsClient = createWSClient({ url: 'ws://localhost:3002' });
const client = createTRPCProxyClient({ links: [wsLink({ client: wsClient })] });

client.onExecutionUpdate.subscribe({ executionId: "exec_xxx" }, {
  onData(event) {
    console.log("执行状态更新:", event);
  },
  onError(err) {
    console.error("订阅错误:", err);
  }
});
```

#### 推送事件格式

```json
{
  "type": "nodeStarted" | "nodeCompleted" | "nodeFailed" | "workflowCompleted" | "workflowFailed",
  "executionId": "exec_1706123456789_abc123",
  "nodeId": "provide-data",
  "timestamp": 1706123456789,
  "data": {
    "nodeId": "provide-data",
    "status": "running" | "success" | "failed",
    "result": {
      "success": true,
      "output": { "recordCount": 100 },
      "error": "错误信息（仅失败时）"
    }
  }
}
```

#### 事件类型说明

- `nodeStarted` - 节点开始执行
- `nodeCompleted` - 节点执行成功
- `nodeFailed` - 节点执行失败
- `workflowCompleted` - 工作流执行完成
- `workflowFailed` - 工作流执行失败

---

## 22. 工作流节点类型参考

### 节点类型枚举

| 类型 | 描述 |
|------|------|
| `start` | 开始节点（非必需） |
| `end` | 结束节点（非必需） |
| `task` | Agenda 任务节点（调用 Agenda 任务队列） |
| `condition` | 条件分支节点 |
| `parallel` | 并行节点 |
| `script` | 脚本节点（执行自定义 JavaScript） |
| `http` | HTTP 请求节点 |

### 条件表达式类型

| 类型 | 描述 |
|------|------|
| `previousNodeSuccess` | 上游节点执行成功 |
| `previousNodeFailed` | 上游节点执行失败 |
| `keyValueMatch` | 键值匹配（如 `previousNode.output.status === "ready"`） |
| `customExpression` | 自定义 JavaScript 表达式 |
