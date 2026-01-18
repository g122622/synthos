# Synthos 热重载（开发期自动重启）实现文档

## 概述

本文档记录 Synthos 后端各子项目在开发环境下实现“改代码自动重启”的方案。

- 目标：修改 `src/` 或 `common/` 后，自动触发构建并重启对应服务
- 范围：后端子项目（ai-model, webui-backend, data-provider, preprocessing, orchestrator, webui-forwarder）
- 说明：这里更准确地说是“热重载/自动重启（hot-reload）”，不是浏览器层面的 HMR

实施日期：2026年1月17日

---

## 技术方案

### 方案选择

我们尝试过两类方案，最终采用统一的 runner 脚本：

1. **tsx watch（初次尝试，已弃用）**
   - 问题：与项目中大量使用的装饰器（如 tsyringe 的 parameter decorators）存在兼容性限制

2. **nodemon + 原有构建流程（中期尝试，已弃用）**
   - nodemon 相关的 `dev.js` / `nodemon.json` / `start*.js` 等文件已从仓库移除

3. **scripts/devRunner.cjs（最终采用）** ✅
   - 使用 `chokidar` 监听文件变化
   - 变化后执行现有构建流程，再重启 Node 进程
   - 统一封装 Windows 下的进程树结束、端口占用清理等细节

### 架构设计

```
开发者修改代码
   │
   ▼
chokidar 监听变化 (src + common)
   │
   ▼
执行构建流程
  1) pnpm -s run build
  2) node ../../scripts/redirectRequire.js
  3) node ../../scripts/fixESMExtensions.mjs
   │
   ▼
停止旧进程 /（可选）释放端口
   │
   ▼
启动新进程 (node <entry>)
```

---

## 使用方式

### 1) 安装依赖

根工作区需要：

```bash
pnpm add -Dw chokidar concurrently
```

> 注：`nodemon` / `tsx` 不再作为本方案的必要依赖。

### 2) 子项目 dev 脚本

每个后端子项目的 `package.json` 将 `dev` 指向统一 runner，例如（示意）：

```json
{
  "scripts": {
    "dev": "node ../../scripts/devRunner.cjs --name ai-model --entry dist/index.js --kill-port 7979"
  }
}
```

其中：

- `--name`：用于日志标识
- `--entry`：构建产物入口（通常是 `dist/index.js`）
- `--kill-port`：可选；在 Windows 上常见的端口占用问题可通过它在重启前释放端口

更完整参数请直接查看 [scripts/devRunner.cjs](scripts/devRunner.cjs)。

### 3) Workspace 一键启动

根 `package.json` 提供并行启动命令（依赖 `concurrently`）：

- `pnpm dev:backend`：启动后端相关服务
- `pnpm dev:all`：启动后端 + 前端
- `pnpm dev:config`：启动配置面板相关
- `pnpm dev:forwarder`：启动带 forwarder 的组合

### 4) 启动前命令（可选）

你可以在启动上述“一次启动多个子项目”的命令之前，先执行一个自定义命令（会开独立子进程执行，**不等待其执行完成**）。

在 `synthos_config.json` 增加：

```json
{
   "preStartCommand": {
      "enabled": true,
      "command": "<你的命令字符串>",
      "silent": true,
      "detached": false
   }
}
```

说明：

- `command`：交给系统 shell 解析执行，适合写一整串命令
- `silent`：是否静默（不输出 stdout/stderr）
- `detached`：是否以 detached 方式运行（父进程退出后仍继续运行）

---

## 故障排查

### 问题 1：修改后没有触发重启

- 确认变更文件在监听范围内（通常为子项目 `src/` 以及 `common/`）
- 查看 devRunner 的输出日志，确认 watcher 是否启动成功

### 问题 2：构建失败后无法恢复

- 先修复编译错误
- 观察下一次文件变更是否触发重新构建
- 必要时手动 Ctrl+C 停止后重启 `pnpm dev`

### 问题 3：端口被占用（EADDRINUSE）

- 给对应服务的 dev 脚本加上 `--kill-port <port>`（例如 `3002` / `7979`）
- 或手动排查端口占用后结束进程

---

## 总结

- 当前有效方案为统一的 [scripts/devRunner.cjs](scripts/devRunner.cjs)
- 历史上的 nodemon/tsx 方案已弃用，并且相关脚手架文件已清理
- 后端开发体验：改代码 → 自动构建 → 自动重启
