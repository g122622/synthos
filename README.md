## 系统架构

![alt text](Synthos架构7.drawio.png)

## 快速开始

使用monorepo管理项目，使用pnpm管理依赖。

首先需要在项目根目录下面放好配置文件 `synthos_config.json`

1. 根目录安装依赖

```bash
pnpm i
```

2. 进入子项目目录

```bash
cd apps/data-provider
```

3. 安装子项目依赖

```bash
pnpm i
```

4. 启动子项目

```bash
npm run build && cd dist && node index
```
