# Data Provider Service

数据提供者服务，从即时通讯（如QQ）数据库中提取和解析聊天消息数据。

## 功能特性

- **消息提取**：从QQ数据库中提取群组聊天消息
- **消息解析**：解析protobuf格式的消息内容
- **消息格式化**：将原始消息转换为结构化数据
- **数据提供**：通过统一的接口向其他服务提供消息数据
- **群文件获取**：可选接入 OneBot/NapCat HTTP API，列出群文件并下载到本地目录

## 技术栈

- **protobufjs**：Protocol Buffers解析
- **axios**：HTTP客户端

## 项目结构

```
src/
├── di/                    # 依赖注入容器
├── providers/             # 数据提供者实现
│   ├── contracts/         # 提供者接口定义
│   ├── OneBotProvider/    # OneBot/NapCat 群文件提供者
│   └── QQProvider/        # QQ消息提供者
│       ├── parsers/       # protobuf消息解析器
│       ├── @types/        # 类型定义
│       └── docs/          # 文档和说明
└── tasks/                 # 数据提供任务
```

## QQ Provider 说明

QQ Provider负责从QQ数据库中读取消息并进行解析：

- 支持解析QQ群组消息
- 处理消息正文、图片、语音等多种消息类型
- 使用protobuf解析消息内容

## OneBot 文件 Provider 说明

OneBot 文件 Provider 通过 OneBot/NapCat HTTP API 获取群文件能力，适合后续构建群文件知识库：

- 支持 `get_group_root_files`、`get_group_file_list`、`get_group_files` 多种文件列表接口
- 支持 `get_group_file_url`、`get_file_url` 获取临时下载链接
- 下载文件时按群号保存到本地目录，并清洗危险文件名字符
- 该 Provider 不会自动接入当前聊天消息 Pipeline，需要由后续群文件同步任务显式调用

配置示例：

```json
{
  "dataProviders": {
    "OneBot": {
      "enabled": true,
      "baseURL": "http://127.0.0.1:3000",
      "accessToken": "",
      "downloadDirectory": "/path/to/group-files",
      "requestTimeoutMs": 30000
    }
  }
}
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
- 使用统一的 IIMProvider 接口提供数据
