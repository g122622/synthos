# AI Model Service

AI模型服务，提供嵌入生成、向量数据库管理、RAG（检索增强生成）、摘要生成、报告生成等功能。

## 功能特性

- **嵌入生成**：使用Ollama Embedding Service生成文本向量嵌入
- **向量数据库管理**：基于SQLite的向量数据库管理，支持嵌入的存储和检索
- **RAG检索**：提供RAG（检索增强生成）能力，支持查询重写和上下文构建
- **AI摘要生成**：对IM消息进行AI摘要生成
- **报告生成**：基于数据分析生成结构化报告
- **兴趣评分**：对聊天内容进行语义相关性评分
- **邮件报告**：将生成的报告通过邮件发送

## 技术栈

- **LangChain**：大语言模型应用框架
- **LangChain OpenAI**：OpenAI模型集成
- **SQLite + sqlite-vec**：向量数据库
- **protobufjs**：Protocol Buffers支持

## 项目结构

```
src/
├── context/          # 上下文构建器和提示词存储
│   ├── ctxBuilders/  # 上下文构建器实现
│   └── prompts/      # 提示词存储
├── di/               # 依赖注入容器
├── embedding/        # 嵌入生成和向量数据库管理
├── generators/       # 文本生成器
├── rag/              # RAG相关实现
├── rpc/              # RPC服务接口
├── services/         # 邮件等服务
├── tasks/            # 任务实现（摘要、报告、兴趣评分等）
├── utils/            # 工具函数
└── test/             # 单元测试和集成测试
```

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
- 配置文件通过 ConfigManagerService 管理
