# WebUI Backend API 文档

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
