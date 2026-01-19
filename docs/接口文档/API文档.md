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
- `GET /api/chat-messages-by-group-id` 的 `timeStart/timeEnd` 来自 query string，后端会 `parseInt`，因此请传字符串形式的数字。

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
}
```

---

## 11. RAG 问答历史（WebUI 本地存储）

### POST /api/rag/session/create

Body：

```ts
{
  question: string;
  answer: string;
  references: { topicId: string; topic: string; relevance: number }[];
  topK: number;
  enableQueryRewriter?: boolean; // 默认为 true
}
```

响应 `data`（会话详情）：

```ts
{
  id: string;
  title: string;
  question: string;
  answer: string;
  references: { topicId: string; topic: string; relevance: number }[];
  topK: number;
  enableQueryRewriter: boolean;
  createdAt: number;
  updatedAt: number;
}
```

### POST /api/rag/session/list

Body：`{ "limit": number; "offset": number }`

响应 `data`：

```ts
{
  sessions: { id: string; title: string; createdAt: number; updatedAt: number }[];
  total: number;
  hasMore: boolean;
}
```

### POST /api/rag/session/detail

Body：`{ "sessionId": string }`

响应：

- 存在：`{ success: true, data: SessionDetail }`
- 不存在：`{ success: false, message: "会话不存在" }`（HTTP 仍为 200）

### POST /api/rag/session/delete

Body：`{ "sessionId": string }`

响应：`{ "success": true, "message": "会话已删除" }`

### POST /api/rag/session/update-title

Body：`{ "sessionId": string; "title": string }`

响应：`{ "success": true, "message": "标题已更新" }`

### POST /api/rag/session/clear-all

响应：`{ "success": true, "message": "所有会话已清空" }`

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
