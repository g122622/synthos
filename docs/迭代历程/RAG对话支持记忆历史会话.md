【背景】

applications/webui-frontend/src/pages/rag/rag.tsx是rag页面，负责展示并渲染rag回答结果、rag召回的文档片段等。

现在希望它能记忆用户的历史提问（就像chat-gpt那样）

【一些实现细节】

需要注意，目前这个系统是不支持多轮对话的（一次会话用户只能提问一次）

1. 新开一个数据库，位于apps/webui-backend/src/repositories/RagChatHistoryManager.ts，使用SQLite（可参考common/database/AGCDBManager.ts的实现）。RAG历史记录是webui-backend专用的功能，放在 repositories/ 目录是合理的。
2. 为了避免页面主文件过大，新增的子组件放在apps/webui-frontend/src/pages/rag/components
3. 对于AI回答：还需要保存references（参考来源）
4. 会话持久化的范围：只存储问答（Ask）Tab的历史
5. 数据库的位置使用webUI_Backend配置项的dbBasePath（需要你新增），数据库名字使用RagChatHistory.db

【UI交互设计】

参考ChatGPT：
- 左侧显示历史会话列表（可折叠/展开）
- 点击历史会话可以恢复对话上下文
- 支持新建会话、删除会话
