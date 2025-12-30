# WebUI Backend API 文档

目前后端地址部署在 <http://localhost:3002/>

## 通用响应格式

### 成功响应

```json
{
  "success": true,
  "data": {}
}
```

### 错误响应

```json
{
  "success": false,
  "message": "错误描述"
}
```

## 健康检查接口

### 1. 服务健康检查

**接口地址**: `GET /health`

**请求参数**: 无

**响应示例**:

```json
{
  "success": true,
  "message": "WebUI后端服务运行正常",
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

**状态码**:

- `200`: 服务正常运行

## 群组相关接口

### 1. 获取所有群组详情

**接口地址**: `GET /api/group-details`

**请求参数**: 无

**响应示例**:

```json
{
  "success": true,
  "data": {
    "群号1": {
      "IM": "QQ",
      "splitStrategy": "realtime",
      "groupIntroduction": "这是一个示例群组",
      "aiModel": "gpt-3.5-turbo"
    },
    "群号2": {
      "IM": "WeChat",
      "splitStrategy": "accumulative",
      "groupIntroduction": "这是另一个示例群组",
      "aiModel": "gpt-4"
    }
  }
}
```

**状态码**:

- `200`: 获取成功
- `500`: 服务器内部错误

## 聊天消息相关接口

### 1. 获取指定群组的聊天消息

**接口地址**: `GET /api/chat-messages-by-group-id`

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| groupId | string | 是 | 群组ID |
| timeStart | number | 是 | 起始时间戳（毫秒） |
| timeEnd | number | 是 | 结束时间戳（毫秒） |

**响应示例**:

```json
{
  "success": true,
  "data": [
    {
      "msgId": "123456789",
      "messageContent": "这是一条示例消息",
      "groupId": "群号1",
      "timestamp": 1640995200000,
      "senderId": "用户ID1",
      "senderGroupNickname": "用户群昵称",
      "senderNickname": "用户昵称",
      "quotedMsgId": "987654321",
      "sessionId": "会话ID1",
      "preProcessedContent": "预处理后的内容"
    }
  ]
}
```

**状态码**:

- `200`: 获取成功
- `400`: 缺少必要参数
- `500`: 服务器内部错误

## AI摘要相关接口

### 1. 根据主题ID获取AI摘要结果

**接口地址**: `GET /api/ai-digest-result-by-topic-id`

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| topicId | string | 是 | 主题ID |

**响应示例**:

```json
{
  "success": true,
  "data": {
    "topicId": "主题ID1",
    "sessionId": "会话ID1",
    "topic": "讨论主题",
    "contributors": "参与者列表",
    "detail": "摘要详情正文"
  }
}
```

**状态码**:

- `200`: 获取成功
- `400`: 缺少topicId参数
- `404`: 未找到对应的摘要结果
- `500`: 服务器内部错误

### 2. 根据会话ID获取AI摘要结果

**接口地址**: `GET /api/ai-digest-results-by-session-id`

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| sessionId | string | 是 | 会话ID |

**响应示例**:

```json
{
  "success": true,
  "data": [
    {
      "topicId": "主题ID1",
      "sessionId": "会话ID1",
      "topic": "讨论主题1",
      "contributors": "参与者列表1",
      "detail": "摘要详情正文1"
    },
    {
      "topicId": "主题ID2",
      "sessionId": "会话ID1",
      "topic": "讨论主题2",
      "contributors": "参与者列表2",
      "detail": "摘要详情正文2"
    }
  ]
}
```

**状态码**:

- `200`: 获取成功
- `400`: 缺少sessionId参数
- `500`: 服务器内部错误

### 3. 检查会话是否已摘要

**接口地址**: `GET /api/is-session-summarized`

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| sessionId | string | 是 | 会话ID |

**响应示例**:

```json
{
  "success": true,
  "data": {
    "isSummarized": true
  }
}
```

**状态码**:

- `200`: 获取成功
- `400`: 缺少sessionId参数
- `500`: 服务器内部错误

## 其他接口

### 1. 获取QQ头像

**接口地址**: `GET /api/qq-avatar`

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| qqNumber | string | 是 | QQ号码 |

**响应示例**:

```json
{
  "success": true,
  "data": {
    "avatarBase64": "base64编码的图片数据"
  }
}
```

**状态码**:

- `200`: 获取成功
- `400`: 缺少qqNumber参数
- `500`: 服务器内部错误

## 话题收藏状态管理接口

### 1. 标记话题为收藏

**接口地址**: `POST /api/topic/favorite/mark`

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| topicId | string | 是 | 话题ID |

**请求体示例**:

```json
{
  "topicId": "话题ID1"
}
```

**响应示例**:

```json
{
  "success": true,
  "message": "话题已标记为收藏"
}
```

**状态码**:

- `200`: 标记成功
- `400`: 缺少topicId参数或参数类型不正确
- `500`: 服务器内部错误

### 2. 从收藏中移除话题

**接口地址**: `POST /api/topic/favorite/remove`

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| topicId | string | 是 | 话题ID |

**请求体示例**:

```json
{
  "topicId": "话题ID1"
}
```

**响应示例**:

```json
{
  "success": true,
  "message": "话题已从收藏中移除"
}
```

**状态码**:

- `200`: 移除成功
- `400`: 缺少topicId参数或参数类型不正确
- `500`: 服务器内部错误

### 3. 检查多个话题是否被收藏

**接口地址**: `POST /api/topic/favorite/status`

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| topicIds | string[] | 是 | 话题ID数组 |

**请求体示例**:

```json
{
  "topicIds": ["话题ID1", "话题ID2", "话题ID3"]
}
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "favoriteStatus": {
      "话题ID1": true,
      "话题ID2": false,
      "话题ID3": true
    }
  }
}
```

**状态码**:

- `200`: 获取成功
- `400`: 缺少topicIds参数或参数类型不正确
- `500`: 服务器内部错误

## 话题已读状态管理接口

### 1. 标记话题为已读

**接口地址**: `POST /api/topic/read/mark`

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| topicId | string | 是 | 话题ID |

**请求体示例**:

```json
{
  "topicId": "话题ID1"
}
```

**响应示例**:

```json
{
  "success": true,
  "message": "话题已标记为已读"
}
```

**状态码**:

- `200`: 标记成功
- `400`: 缺少topicId参数或参数类型不正确
- `500`: 服务器内部错误

### 2. 清除话题的已读状态

**接口地址**: `POST /api/topic/read/unmark`

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| topicId | string | 是 | 话题ID |

**请求体示例**:

```json
{
  "topicId": "话题ID1"
}
```

**响应示例**:

```json
{
  "success": true,
  "message": "话题已读状态已清除"
}
```

**状态码**:

- `200`: 清除成功
- `400`: 缺少topicId参数或参数类型不正确
- `500`: 服务器内部错误

### 3. 检查多个话题是否已读

**接口地址**: `POST /api/topic/read/status`

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| topicIds | string[] | 是 | 话题ID数组 |

**请求体示例**:

```json
{
  "topicIds": ["话题ID1", "话题ID2", "话题ID3"]
}
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "readStatus": {
      "话题ID1": true,
      "话题ID2": false,
      "话题ID3": true
    }
  }
}
```

**状态码**:

- `200`: 获取成功
- `400`: 缺少topicIds参数或参数类型不正确
- `500`: 服务器内部错误

## 日报已读状态管理接口

### 1. 标记日报为已读

**接口地址**: `POST /api/report/read/mark`

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| reportId | string | 是 | 日报ID |

**请求体示例**:

```json
{
  "reportId": "日报ID1"
}
```

**响应示例**:

```json
{
  "success": true,
  "message": "日报已标记为已读"
}
```

**状态码**:

- `200`: 标记成功
- `400`: 缺少reportId参数或参数类型不正确
- `500`: 服务器内部错误

### 2. 清除日报的已读状态

**接口地址**: `POST /api/report/read/unmark`

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| reportId | string | 是 | 日报ID |

**请求体示例**:

```json
{
  "reportId": "日报ID1"
}
```

**响应示例**:

```json
{
  "success": true,
  "message": "日报已读状态已清除"
}
```

**状态码**:

- `200`: 清除成功
- `400`: 缺少reportId参数或参数类型不正确
- `500`: 服务器内部错误

### 3. 检查多个日报是否已读

**接口地址**: `POST /api/report/read/status`

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| reportIds | string[] | 是 | 日报ID数组 |

**请求体示例**:

```json
{
  "reportIds": ["日报ID1", "日报ID2", "日报ID3"]
}
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "readStatus": {
      "日报ID1": true,
      "日报ID2": false,
      "日报ID3": true
    }
  }
}
```

**状态码**:

- `200`: 获取成功
- `400`: 缺少reportIds参数或参数类型不正确
- `500`: 服务器内部错误

## 消息统计接口

### 1. 获取多个群组的每小时消息统计

**接口地址**: `POST /api/message-hourly-stats`

**接口说明**: 获取多个群组在最近24小时和前一天24小时的每小时消息量统计。时间槽采用整点对齐方式（例如：13:00-14:00 为一个时间槽）。

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| groupIds | string[] | 是 | 群组ID数组 |

**请求体示例**:

```json
{
  "groupIds": ["群号1", "群号2", "群号3"]
}
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "data": {
      "群号1": {
        "current": [0, 5, 10, 3, 8, 12, 15, 20, 25, 18, 22, 16, 14, 11, 9, 7, 5, 3, 2, 1, 0, 0, 0, 0],
        "previous": [0, 3, 8, 2, 6, 10, 12, 18, 22, 15, 19, 14, 12, 9, 7, 5, 4, 2, 1, 0, 0, 0, 0, 0]
      },
      "群号2": {
        "current": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
        "previous": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]
      }
    },
    "timestamps": {
      "current": [1703548800000, 1703552400000, "...共24个整点时间戳"],
      "previous": [1703462400000, 1703466000000, "...共24个整点时间戳"]
    },
    "totalCounts": {
      "current": 500,
      "previous": 450
    }
  }
}
```

**响应字段说明**:

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| data | Record<string, object> | 每个群组的统计数据 |
| data[groupId].current | number[] | 当前24小时的每小时消息量数组（24个元素） |
| data[groupId].previous | number[] | 前一天24小时的每小时消息量数组（24个元素） |
| timestamps.current | number[] | 当前24小时的整点时间戳数组（24个元素） |
| timestamps.previous | number[] | 前一天24小时的整点时间戳数组（24个元素） |
| totalCounts.current | number | 所有群组当前24小时的消息总量 |
| totalCounts.previous | number | 所有群组前一天24小时的消息总量 |

**状态码**:

- `200`: 获取成功
- `400`: 缺少groupIds参数或参数类型不正确
- `500`: 服务器内部错误
