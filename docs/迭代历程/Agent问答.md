RAG问答新增agent能力，可调用的工具如下：

- RAG搜索
- SQL查询（查之前先返回一次数量）
- Web搜索

目前已升级为 REST SSE（`POST /api/agent/ask/stream`）实现全流式，并定义稳定的业务事件协议：

- `token`：模型输出的增量文本
- `tool_call`：工具调用（用于审阅展示）
- `tool_result`：工具结果（任意 JSON，用于审阅展示）
- `done`：一次问答结束（含落库后的 `messageId` 等摘要信息）
- `error`：错误
