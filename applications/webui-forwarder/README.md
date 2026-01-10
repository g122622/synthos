# WebUI Forwarder

WebUI 前后端接口转发服务，用于将本地服务暴露到公网。

## 功能特性

- **端口转发**：将本地服务端口映射到公网URL
- **公网访问**：支持通过公网URL访问本地WebUI
- **隧道管理**：创建和管理ngrok隧道

## 技术栈

- **ngrok**：反向代理隧道服务

## 使用场景

当你需要在外部环境（如移动设备）访问本地运行的WebUI时，可以使用此服务。

## 开发命令

```bash
# 构建
pnpm run build

# 启动转发服务
pnpm run dev
```

## 工作原理

1. 启动后端服务（webui-backend）
2. 启动前端服务（webui-frontend）
3. 运行 webui-forwarder 创建公网隧道
4. 通过生成的公网URL访问服务

## 注意事项

- 需要ngrok账户和认证token
- 公网URL是临时的，每次重启都会变化
- 仅用于开发和测试，不推荐用于生产环境

## 依赖说明

- 依赖 webui-backend 和 webui-foreground 服务先启动
- 通过 ngrok 创建安全隧道
