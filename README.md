## 系统架构

![alt text](Synthos架构7.drawio.png)

## TODO任务单

- 前端界面
- 转发聊天记录跟随
- 引用聊天记录跟随
- 自动拉取历史聊天记录

## 快速开始

使用monorepo管理项目，使用pnpm管理依赖。

重要：首先需要在项目根目录下面放好配置文件 `synthos_config.json`，配置文件的填写格式请自己参考源码中的相应类型声明。

重要：此外，项目使用agenda进行任务编排和调度，底层依赖于MongoDB，需要提前下载安装好：[https://www.mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)

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
